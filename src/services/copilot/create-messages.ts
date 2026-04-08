/**
 * Anthropic Messages API Service
 * Supports extended thinking and adaptive reasoning
 */

import consola from "consola"
import { events } from "fetch-event-stream"

import type {
  AnthropicMessagesPayload,
  AnthropicResponse,
} from "~/routes/messages/anthropic-types"
import type { SubagentMarker } from "~/routes/messages/subagent-marker"

import {
  getCurrentAccount,
  isPoolEnabledSync,
  reportAccountError,
} from "~/lib/account-pool"
import {
  copilotBaseUrl,
  copilotHeaders,
  prepareForCompact,
  prepareInteractionHeaders,
} from "~/lib/api-config"
import { getConfig } from "~/lib/config"
import { HTTPError } from "~/lib/error"
import { getBestFallback } from "~/lib/fallback"
import { fetchWithTimeout } from "~/lib/fetch-with-timeout"
import { sleep } from "~/lib/retry"
import { state } from "~/lib/state"
import { getActiveCopilotToken } from "~/lib/token"

export type MessagesStream = ReturnType<typeof events>
export type CreateMessagesReturn = AnthropicResponse | MessagesStream

const INTERLEAVED_THINKING_BETA = "interleaved-thinking-2025-05-14"
const allowedAnthropicBetas = new Set([
  INTERLEAVED_THINKING_BETA,
  "context-management-2025-06-27",
  "advanced-tool-use-2025-11-20",
])

const MAX_RETRY_ATTEMPTS = 3

function getRateLimitResetAt(response: Response): number | undefined {
  const retryAfterRaw = response.headers.get("retry-after")
  if (!retryAfterRaw) return undefined

  const retrySeconds = Number.parseInt(retryAfterRaw, 10)
  if (!Number.isNaN(retrySeconds)) {
    return Date.now() + retrySeconds * 1000
  }

  const retryAt = Date.parse(retryAfterRaw)
  if (!Number.isNaN(retryAt)) {
    return retryAt
  }

  return undefined
}

/**
 * Build anthropic-beta header based on client header and thinking config
 */
const buildAnthropicBetaHeader = (
  anthropicBetaHeader: string | undefined,
  thinking: AnthropicMessagesPayload["thinking"],
): string | undefined => {
  const isAdaptiveThinking = thinking?.type === "adaptive"

  if (anthropicBetaHeader) {
    const filteredBeta = anthropicBetaHeader
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
      .filter((item) => allowedAnthropicBetas.has(item))
    const uniqueFilteredBetas = [...new Set(filteredBeta)]
    const finalFilteredBetas =
      isAdaptiveThinking ?
        uniqueFilteredBetas.filter((item) => item !== INTERLEAVED_THINKING_BETA)
      : uniqueFilteredBetas

    if (finalFilteredBetas.length > 0) {
      return finalFilteredBetas.join(",")
    }

    return undefined
  }

  if (thinking?.budget_tokens && !isAdaptiveThinking) {
    return INTERLEAVED_THINKING_BETA
  }

  return undefined
}

export interface CreateMessagesOptions {
  subagentMarker?: SubagentMarker | null
  requestId: string
  sessionId?: string
  isCompact?: boolean
}

/**
 * Create messages using Anthropic Messages API (/v1/messages)
 * Supports extended thinking and adaptive reasoning
 */
/* eslint-disable max-lines-per-function, complexity, max-depth */
export const createMessages = async (
  payload: AnthropicMessagesPayload,
  anthropicBetaHeader: string | undefined,
  options: CreateMessagesOptions,
): Promise<CreateMessagesReturn> => {
  consola.debug("[createMessages] Starting request...")

  const config = getConfig()
  let currentPayload = payload
  let accountRotationAttempts = 0
  const MAX_ACCOUNT_ROTATION_ATTEMPTS = isPoolEnabledSync() ? 3 : 0

  for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
    try {
      // Use pool token if enabled, otherwise fall back to state token
      consola.debug("[createMessages] Getting copilot token...")
      const copilotToken = await getActiveCopilotToken()
      consola.debug("[createMessages] Got copilot token")

      const enableVision = currentPayload.messages.some(
        (message) =>
          Array.isArray(message.content)
          && message.content.some((block) => block.type === "image"),
      )

      // Determine if this is a user-initiated request
      let isInitiateRequest = false
      const lastMessage = currentPayload.messages.at(-1)
      if (lastMessage?.role === "user") {
        isInitiateRequest =
          Array.isArray(lastMessage.content) ?
            lastMessage.content.some((block) => block.type !== "tool_result")
          : true
      }

      const headers: Record<string, string> = {
        ...copilotHeaders(state, {
          vision: enableVision,
          requestId: options.requestId,
          token: copilotToken,
        }),
        "x-initiator": isInitiateRequest ? "user" : "agent",
      }

      prepareInteractionHeaders(
        options.sessionId,
        Boolean(options.subagentMarker),
        headers,
      )

      prepareForCompact(headers, options.isCompact)

      // Build anthropic-beta header for thinking support
      const anthropicBeta = buildAnthropicBetaHeader(
        anthropicBetaHeader,
        currentPayload.thinking,
      )
      if (anthropicBeta) {
        headers["anthropic-beta"] = anthropicBeta
      }

      consola.debug("Messages API request:", {
        url: `${copilotBaseUrl(state)}/v1/messages`,
        thinking: currentPayload.thinking,
        output_config: currentPayload.output_config,
        anthropicBeta,
      })

      const requestUrl = `${copilotBaseUrl(state)}/v1/messages`
      consola.debug(
        `[createMessages] Sending to ${requestUrl} (timeout: ${config.requestTimeoutMs}ms)`,
      )
      const fetchStartTime = Date.now()

      const response = await fetchWithTimeout(requestUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(currentPayload),
        timeout: config.requestTimeoutMs,
      })

      consola.debug(
        `[createMessages] Response: ${response.status} (${Date.now() - fetchStartTime}ms)`,
      )

      // Handle rate limit with account rotation
      if (response.status === 429) {
        if (
          isPoolEnabledSync()
          && accountRotationAttempts < MAX_ACCOUNT_ROTATION_ATTEMPTS
        ) {
          const currentAccount = getCurrentAccount()
          consola.warn(
            `Account-level rate limit hit for "${currentAccount?.login || "unknown"}". Attempting account rotation...`,
          )

          // Report error - this will trigger auto-rotation
          reportAccountError("rate-limit", getRateLimitResetAt(response))

          // Get new token after rotation (triggers account selection)
          await getActiveCopilotToken()
          const newAccount = getCurrentAccount()

          if (newAccount?.id !== currentAccount?.id) {
            accountRotationAttempts++
            consola.info(
              `Rotated to account "${newAccount?.login || "unknown"}". Retrying request (rotation ${accountRotationAttempts}/${MAX_ACCOUNT_ROTATION_ATTEMPTS})...`,
            )
            continue // Retry with new account
          }

          consola.warn(
            `No available account after rotation. Attempting fallback to claude-sonnet-4.5...`,
          )
        }

        // Try fallback to claude-sonnet-4.5
        const fallbackModel = getBestFallback(currentPayload.model)
        if (fallbackModel && fallbackModel !== currentPayload.model) {
          consola.warn(
            `Falling back from "${currentPayload.model}" to "${fallbackModel}" due to rate limit`,
          )
          currentPayload = { ...currentPayload, model: fallbackModel }
          continue // Retry with fallback model
        }

        // If no fallback available, throw error
        const errorText = await response
          .text()
          .catch(() => "Rate limit exceeded")
        consola.error(
          `Failed to create messages: rate limit with no fallback available. Error: ${errorText}`,
        )
        throw new HTTPError("Failed to create messages", response)
      }

      if (!response.ok) {
        if (attempt < MAX_RETRY_ATTEMPTS) {
          const delayMs = 1000 * Math.pow(2, attempt - 1)
          consola.warn(
            `Request failed with ${response.status}. Retrying (${attempt}/${MAX_RETRY_ATTEMPTS}) in ${delayMs}ms...`,
          )
          await sleep(delayMs)
          continue
        }

        const errorText = await response.text().catch(() => "Unknown error")
        consola.error("Failed to create messages:", response.status, errorText)
        throw new HTTPError("Failed to create messages", response)
      }

      if (currentPayload.stream) {
        return events(response)
      }

      return (await response.json()) as AnthropicResponse
    } catch (error) {
      if (attempt < MAX_RETRY_ATTEMPTS) {
        const delayMs = 1000 * Math.pow(2, attempt - 1)
        consola.warn(
          `Request error: ${error instanceof Error ? error.message : String(error)}. Retrying (${attempt}/${MAX_RETRY_ATTEMPTS}) in ${delayMs}ms...`,
        )
        await sleep(delayMs)
        continue
      }
      throw error
    }
  }

  throw new Error("Failed to create messages after all retries")
}
