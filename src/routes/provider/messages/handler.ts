/**
 * Provider Messages Handler
 * Forwards messages to external Anthropic-compatible providers
 */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/restrict-template-expressions */

import type { Context } from "hono"

import consola from "consola"

import { getConfig, type ProviderConfig } from "~/lib/config"
import {
  buildProviderUpstreamHeaders,
  createProviderProxyResponse,
  normalizeProviderBaseUrl,
  type ResolvedProviderConfig,
} from "~/services/providers/anthropic-proxy"

/**
 * Get resolved provider config by name
 */
export function getProviderConfig(name: string): ResolvedProviderConfig | null {
  const config = getConfig()
  const providers = (config as Record<string, unknown>).providers as
    | Record<string, ProviderConfig>
    | undefined

  if (!providers) return null

  const provider = providers[name]
  if (!provider || !provider.enabled) return null

  // Only support anthropic type
  if (provider.type !== "anthropic") {
    consola.warn(`Provider "${name}" has unsupported type: ${provider.type}`)
    return null
  }

  // Validate required fields
  if (!provider.baseUrl || !provider.apiKey) {
    consola.warn(`Provider "${name}" missing required baseUrl or apiKey`)
    return null
  }

  return { ...provider, name }
}

/**
 * Adjust input tokens by subtracting cache read tokens
 * This provides more accurate token counts for billing
 */
export function adjustUsageTokens(
  body: Record<string, unknown>,
): Record<string, unknown> {
  const usage = body.usage as Record<string, number> | undefined
  if (!usage) return body

  // Subtract cache_read_input_tokens from input_tokens if both exist
  if (
    typeof usage.input_tokens === "number"
    && typeof usage.cache_read_input_tokens === "number"
  ) {
    usage.input_tokens = Math.max(
      0,
      usage.input_tokens - usage.cache_read_input_tokens,
    )
  }

  return body
}

/**
 * Handle provider messages request
 */
export async function handleProviderMessages(c: Context) {
  const providerName = c.req.param("provider")

  if (!providerName) {
    return c.json({ error: { message: "Provider name is required" } }, 400)
  }

  const provider = getProviderConfig(providerName)

  if (!provider) {
    return c.json({ error: { message: "Provider not found or disabled" } }, 404)
  }

  const payload = await c.req.json()

  // Apply model-specific config if exists
  const modelConfig = provider.models?.[payload.model]
  if (modelConfig) {
    if (modelConfig.temperature !== undefined) {
      payload.temperature = modelConfig.temperature
    }
    if (modelConfig.topP !== undefined) {
      payload.top_p = modelConfig.topP
    }
    if (modelConfig.topK !== undefined) {
      payload.top_k = modelConfig.topK
    }
  }

  const baseUrl = normalizeProviderBaseUrl(provider.baseUrl)
  const headers = buildProviderUpstreamHeaders(c, provider)

  const response = await fetch(`${baseUrl}/v1/messages`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  })

  // If adjustInputTokens is enabled and response is successful non-streaming
  // Adjust token counts to exclude cache reads
  if (provider.adjustInputTokens && response.ok && !payload.stream) {
    try {
      const body = (await response.json()) as Record<string, unknown>
      const adjustedBody = adjustUsageTokens(body)
      return c.json(adjustedBody)
    } catch {
      // If JSON parsing fails, fall through to proxy response
      consola.warn("Failed to parse provider response for token adjustment")
    }
  }

  return createProviderProxyResponse(response)
}
