/**
 * Messages API Bridge for Chat Completions
 *
 * Automatically converts chat completions requests to the Messages API
 * format when the requested model only supports the /v1/messages endpoint
 * (e.g., Claude 4.6 models).
 *
 * This allows clients that only speak the /v1/chat/completions protocol
 * (like Claude Code) to transparently use Claude 4.6 models.
 */

import type { Context } from "hono"

import consola from "consola"
import { streamSSE, type SSEMessage } from "hono/streaming"

import type {
  ChatCompletionChunk,
  ChatCompletionResponse,
  ChatCompletionsPayload,
  ContentPart,
  Message,
  ToolCall,
} from "~/services/copilot/create-chat-completions"

import { getReasoningEffortForModel } from "~/lib/config"
import { logEmitter } from "~/lib/logger"
import { state } from "~/lib/state"
import {
  type AnthropicAssistantContentBlock,
  type AnthropicMessage,
  type AnthropicMessagesPayload,
  type AnthropicResponse,
  type AnthropicTextBlock,
  type AnthropicThinkingBlock,
  type AnthropicTool,
  type AnthropicToolUseBlock,
  type AnthropicUserContentBlock,
} from "~/routes/messages/anthropic-types"
import {
  createMessages,
  type MessagesStream,
} from "~/services/copilot/create-messages"

const MESSAGES_ENDPOINT = "/v1/messages"
const CHAT_COMPLETIONS_ENDPOINT = "/chat/completions"

/**
 * Models that require Messages API instead of Chat Completions.
 * These models only support /v1/messages endpoint.
 */
const MESSAGES_API_ONLY_MODELS = new Set([
  "claude-opus-4.6",
  "claude-opus-4.6-fast",
  "claude-sonnet-4.6",
])

/**
 * Check if a model ID matches Messages API only patterns.
 */
function isMessagesApiOnlyModel(modelId: string): boolean {
  // Direct match
  if (MESSAGES_API_ONLY_MODELS.has(modelId)) {
    return true
  }

  // Check with level suffix (e.g., claude-opus-4.6(high))
  const baseModel = modelId.replace(/\((?:low|medium|high)\)$/, "")
  if (MESSAGES_API_ONLY_MODELS.has(baseModel)) {
    return true
  }

  // Check for pattern: claude-*-4.6* (excluding 4.5)
  if (
    modelId.startsWith("claude-")
    && (modelId.includes("-4.6") || modelId.includes("-4-6"))
  ) {
    return true
  }

  return false
}

/**
 * Check if a model requires the Messages API instead of Chat Completions.
 * Returns true if model only supports /v1/messages endpoint.
 */
export function modelRequiresMessagesApi(modelId: string): boolean {
  // First check hardcoded list for known models
  if (isMessagesApiOnlyModel(modelId)) {
    return true
  }

  // Then check model metadata from API
  const model = state.models?.data.find((m) => m.id === modelId)
  if (!model) return false

  const endpoints = model.supported_endpoints
  if (!endpoints || endpoints.length === 0) return false

  const supportsMessages = endpoints.includes(MESSAGES_ENDPOINT)
  const supportsChatCompletions = endpoints.includes(CHAT_COMPLETIONS_ENDPOINT)

  // Only requires Messages API if it supports messages but NOT chat completions
  return supportsMessages && !supportsChatCompletions
}

// ==========================================
// Payload Conversion: OpenAI → Anthropic
// ==========================================

function extractTextFromContent(content: Message["content"]): string {
  if (typeof content === "string") return content
  if (!Array.isArray(content)) return ""
  return content
    .filter(
      (p): p is ContentPart & { type: "text"; text: string } =>
        p.type === "text",
    )
    .map((p) => p.text)
    .join("\n")
}

function parseDataUrl(
  url: string,
): { mediaType: string; data: string } | undefined {
  const match = url.match(/^data:([^;]+);base64,(.+)$/)
  if (!match) return undefined
  return { mediaType: match[1], data: match[2] }
}

function convertImagePartToBlock(
  part: ContentPart & { type: "image_url" },
): AnthropicUserContentBlock {
  const url = part.image_url.url
  if (url.startsWith("data:")) {
    const parsed = parseDataUrl(url)
    if (parsed) {
      return {
        type: "image",
        source: {
          type: "base64",
          media_type: parsed.mediaType as
            | "image/jpeg"
            | "image/png"
            | "image/gif"
            | "image/webp",
          data: parsed.data,
        },
      }
    }
  }
  // URL-based image
  return {
    type: "image",
    source: {
      type: "url",
      url,
    },
  } as unknown as AnthropicUserContentBlock
}

function convertToAnthropicContent(
  content: Message["content"],
): string | Array<AnthropicUserContentBlock | AnthropicAssistantContentBlock> {
  if (typeof content === "string") return content
  if (!content) return ""
  if (!Array.isArray(content)) return ""

  const hasImage = content.some((p) => p.type === "image_url")
  if (!hasImage) {
    return extractTextFromContent(content)
  }

  const blocks: Array<AnthropicUserContentBlock> = []
  for (const part of content) {
    if (part.type === "text") {
      blocks.push({ type: "text", text: part.text })
    } else {
      // part.type === "image_url"
      blocks.push(convertImagePartToBlock(part))
    }
  }
  return blocks
}

function convertToolCallsToToolUse(
  toolCalls: Array<ToolCall>,
): Array<AnthropicToolUseBlock> {
  return toolCalls.map((tc) => ({
    type: "tool_use" as const,
    id: tc.id,
    name: tc.function.name,
    input: JSON.parse(tc.function.arguments || "{}") as Record<string, unknown>,
  }))
}

function appendToolResultToLastUserMessage(
  anthropicMessages: Array<AnthropicMessage>,
  toolResultBlock: {
    type: "tool_result"
    tool_use_id: string
    content: string
  },
): void {
  const lastMsg = anthropicMessages.at(-1)
  if (lastMsg && lastMsg.role === "user") {
    if (Array.isArray(lastMsg.content)) {
      lastMsg.content.push(toolResultBlock)
    } else {
      lastMsg.content = [
        { type: "text", text: lastMsg.content },
        toolResultBlock,
      ]
    }
  } else {
    anthropicMessages.push({
      role: "user",
      content: [toolResultBlock],
    })
  }
}

function convertToolMessage(
  msg: Message,
  anthropicMessages: Array<AnthropicMessage>,
): void {
  const toolResultBlock = {
    type: "tool_result" as const,
    tool_use_id: msg.tool_call_id || "",
    content: typeof msg.content === "string" ? msg.content : "",
  }
  appendToolResultToLastUserMessage(anthropicMessages, toolResultBlock)
}

function convertAssistantMessage(msg: Message): AnthropicMessage {
  const content: Array<AnthropicAssistantContentBlock> = []

  const textContent = convertToAnthropicContent(msg.content)
  if (typeof textContent === "string" && textContent) {
    content.push({ type: "text", text: textContent })
  } else if (Array.isArray(textContent)) {
    const textBlocks = textContent.filter(
      (block): block is AnthropicTextBlock => block.type === "text",
    )
    content.push(...textBlocks)
  }

  if (msg.tool_calls && msg.tool_calls.length > 0) {
    content.push(...convertToolCallsToToolUse(msg.tool_calls))
  }

  return {
    role: "assistant",
    content: content.length > 0 ? content : [{ type: "text", text: "" }],
  }
}

function convertUserMessage(msg: Message): AnthropicMessage {
  const content = convertToAnthropicContent(msg.content)
  return {
    role: "user",
    content: content as string | Array<AnthropicUserContentBlock>,
  }
}

function convertMessagesToAnthropic(messages: Array<Message>): {
  system: string | undefined
  anthropicMessages: Array<AnthropicMessage>
} {
  let system: string | undefined
  const anthropicMessages: Array<AnthropicMessage> = []

  for (const msg of messages) {
    switch (msg.role) {
      case "system":
      case "developer": {
        const text = extractTextFromContent(msg.content)
        system = system ? `${system}\n\n${text}` : text
        break
      }
      case "tool": {
        convertToolMessage(msg, anthropicMessages)
        break
      }
      case "assistant": {
        anthropicMessages.push(convertAssistantMessage(msg))
        break
      }
      case "user": {
        anthropicMessages.push(convertUserMessage(msg))
        break
      }
      // No default
    }
  }

  return { system, anthropicMessages }
}

function convertToolsToAnthropic(
  tools: ChatCompletionsPayload["tools"],
): Array<AnthropicTool> | undefined {
  if (!tools || tools.length === 0) return undefined

  return tools.map((tool) => ({
    name: tool.function.name,
    description: tool.function.description,
    input_schema: tool.function.parameters,
  }))
}

function convertToolChoiceToAnthropic(
  toolChoice: ChatCompletionsPayload["tool_choice"],
): AnthropicMessagesPayload["tool_choice"] {
  if (!toolChoice) return undefined

  if (typeof toolChoice === "string") {
    switch (toolChoice) {
      case "auto": {
        return { type: "auto" }
      }
      case "none": {
        return { type: "none" }
      }
      case "required": {
        return { type: "any" }
      }
      default: {
        return undefined
      }
    }
  }

  // Object form: { type: "function", function: { name: "..." } }
  if (toolChoice.function.name) {
    return { type: "tool", name: toolChoice.function.name }
  }

  return undefined
}

/**
 * Get Anthropic effort level from model reasoning config
 */
function getAnthropicEffort(model: string): "low" | "medium" | "high" | "max" {
  const reasoningEffort = getReasoningEffortForModel(model)

  if (reasoningEffort === "xhigh") return "max"
  if (reasoningEffort === "none" || reasoningEffort === "minimal") return "low"

  return reasoningEffort
}

export function convertToMessagesPayload(
  payload: ChatCompletionsPayload,
): AnthropicMessagesPayload {
  const { system, anthropicMessages } = convertMessagesToAnthropic(
    payload.messages,
  )

  const messagesPayload: AnthropicMessagesPayload = {
    model: payload.model,
    messages: anthropicMessages,
    max_tokens: payload.max_tokens ?? 8192,
    stream: payload.stream ?? false,
  }

  if (system) {
    messagesPayload.system = system
  }

  const tools = convertToolsToAnthropic(payload.tools)
  if (tools) {
    messagesPayload.tools = tools
  }

  const toolChoice = convertToolChoiceToAnthropic(payload.tool_choice)
  if (toolChoice) {
    messagesPayload.tool_choice = toolChoice
  }

  if (payload.temperature !== undefined && payload.temperature !== null) {
    messagesPayload.temperature = payload.temperature
  }

  if (payload.top_p !== undefined && payload.top_p !== null) {
    messagesPayload.top_p = payload.top_p
  }

  if (payload.stop) {
    messagesPayload.stop_sequences =
      Array.isArray(payload.stop) ? payload.stop : [payload.stop]
  }

  // Enable thinking for Claude 4.6 models
  const maxThinkingBudget = 128000
  const effort = getAnthropicEffort(payload.model)
  const effortMultiplier: Record<string, number> = {
    low: 0.25,
    medium: 0.5,
    high: 0.75,
    max: 1.0,
  }
  const multiplier = effortMultiplier[effort] ?? 0.75
  const scaledBudget = Math.round(maxThinkingBudget * multiplier)

  messagesPayload.thinking = {
    type: "enabled",
    budget_tokens: Math.max(scaledBudget, 1024),
  }

  return messagesPayload
}

// ==========================================
// Response Conversion: Anthropic → OpenAI
// ==========================================

function mapAnthropicStopReasonToOpenAI(
  stopReason: AnthropicResponse["stop_reason"],
): ChatCompletionResponse["choices"][0]["finish_reason"] {
  switch (stopReason) {
    case "end_turn": {
      return "stop"
    }
    case "max_tokens": {
      return "length"
    }
    case "tool_use": {
      return "tool_calls"
    }
    case "stop_sequence": {
      return "stop"
    }
    default: {
      return "stop"
    }
  }
}

function extractTextFromAnthropicContent(
  content: AnthropicResponse["content"],
): string {
  if (!Array.isArray(content)) return ""

  return content
    .filter(
      (block): block is AnthropicTextBlock | AnthropicThinkingBlock =>
        block.type === "text" || block.type === "thinking",
    )
    .map((block) => (block.type === "text" ? block.text : block.thinking))
    .join("\n\n")
}

function extractToolCallsFromAnthropicContent(
  content: AnthropicResponse["content"],
): Array<ToolCall> {
  if (!Array.isArray(content)) return []

  return content
    .filter(
      (block): block is AnthropicToolUseBlock => block.type === "tool_use",
    )
    .map((block) => ({
      id: block.id,
      type: "function" as const,
      function: {
        name: block.name,
        arguments: JSON.stringify(block.input),
      },
    }))
}

export function convertMessagesResultToCompletion(
  result: AnthropicResponse,
): ChatCompletionResponse {
  const textContent = extractTextFromAnthropicContent(result.content)
  const toolCalls = extractToolCallsFromAnthropicContent(result.content)
  const finishReason = mapAnthropicStopReasonToOpenAI(result.stop_reason)

  return {
    id: result.id,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: result.model,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: textContent || null,
          ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
        },
        logprobs: null,
        finish_reason: finishReason,
      },
    ],
    usage: {
      prompt_tokens: result.usage.input_tokens,
      completion_tokens: result.usage.output_tokens,
      total_tokens: result.usage.input_tokens + result.usage.output_tokens,
    },
  }
}

// ==========================================
// Stream Conversion
// ==========================================

interface StreamConversionState {
  responseId: string
  model: string
  created: number
  currentToolCallIndex: number
  toolCallIds: Map<string, number>
  inputTokens: number
  outputTokens: number
}

function createStreamConversionState(model: string): StreamConversionState {
  return {
    responseId: `chatcmpl-${crypto.randomUUID()}`,
    model,
    created: Math.floor(Date.now() / 1000),
    currentToolCallIndex: -1,
    toolCallIds: new Map(),
    inputTokens: 0,
    outputTokens: 0,
  }
}

function makeChunk(
  ss: StreamConversionState,
  opts: {
    delta: ChatCompletionChunk["choices"][0]["delta"]
    finishReason: ChatCompletionChunk["choices"][0]["finish_reason"]
    usage?: ChatCompletionChunk["usage"]
  },
): ChatCompletionChunk {
  const chunk: ChatCompletionChunk = {
    id: ss.responseId,
    object: "chat.completion.chunk",
    created: ss.created,
    model: ss.model,
    choices: [
      {
        index: 0,
        delta: opts.delta,
        finish_reason: opts.finishReason,
        logprobs: null,
      },
    ],
  }
  if (opts.usage) chunk.usage = opts.usage
  return chunk
}

export interface MessagesBridgeStreamEvent {
  event?: string
  data?: string
  id?: unknown
}

function handleMessageStart(
  parsed: Record<string, unknown>,
  ss: StreamConversionState,
): Array<ChatCompletionChunk> {
  const message = parsed.message as AnthropicResponse | undefined
  if (message) {
    ss.responseId = message.id
    ss.model = message.model
    if (message.usage) {
      ss.inputTokens = message.usage.input_tokens
    }
  }
  return [
    makeChunk(ss, {
      delta: { role: "assistant", content: "" },
      finishReason: null,
    }),
  ]
}

function handleContentBlockStart(
  parsed: Record<string, unknown>,
  ss: StreamConversionState,
): Array<ChatCompletionChunk> {
  const contentBlock = parsed.content_block as Record<string, unknown>
  if (contentBlock.type === "tool_use") {
    ss.currentToolCallIndex++
    const toolId = contentBlock.id as string
    ss.toolCallIds.set(toolId, ss.currentToolCallIndex)

    return [
      makeChunk(ss, {
        delta: {
          tool_calls: [
            {
              index: ss.currentToolCallIndex,
              id: toolId,
              type: "function" as const,
              function: {
                name: contentBlock.name as string,
                arguments: "",
              },
            },
          ],
        },
        finishReason: null,
      }),
    ]
  }
  return []
}

function handleContentBlockDelta(
  parsed: Record<string, unknown>,
  ss: StreamConversionState,
): Array<ChatCompletionChunk> {
  const delta = parsed.delta as Record<string, unknown> | undefined
  if (!delta) return []

  if (delta.type === "text_delta") {
    return [
      makeChunk(ss, {
        delta: { content: delta.text as string },
        finishReason: null,
      }),
    ]
  }
  if (delta.type === "thinking_delta") {
    return [
      makeChunk(ss, {
        delta: { content: delta.thinking as string },
        finishReason: null,
      }),
    ]
  }
  if (delta.type === "input_json_delta" && ss.currentToolCallIndex >= 0) {
    return [
      makeChunk(ss, {
        delta: {
          tool_calls: [
            {
              index: ss.currentToolCallIndex,
              function: { arguments: delta.partial_json as string },
            },
          ],
        },
        finishReason: null,
      }),
    ]
  }
  return []
}

function handleMessageDelta(
  parsed: Record<string, unknown>,
  ss: StreamConversionState,
): Array<ChatCompletionChunk> {
  const delta = parsed.delta as Record<string, unknown> | undefined
  const usage = parsed.usage as { output_tokens?: number } | undefined
  if (usage?.output_tokens) {
    ss.outputTokens = usage.output_tokens
  }

  const stopReason = delta?.stop_reason as string | undefined
  const hasToolCalls = ss.currentToolCallIndex >= 0

  let finishReason: string
  if (stopReason === "tool_use") {
    finishReason = "tool_calls"
  } else if (stopReason === "max_tokens") {
    finishReason = "length"
  } else {
    finishReason = "stop"
  }

  return [
    makeChunk(ss, {
      delta: {},
      finishReason:
        hasToolCalls && finishReason === "stop" ? "tool_calls" : finishReason,
      usage: {
        prompt_tokens: ss.inputTokens,
        completion_tokens: ss.outputTokens,
        total_tokens: ss.inputTokens + ss.outputTokens,
      },
    }),
  ]
}

function convertMessagesStreamEvent(
  _eventType: string,
  data: string,
  ss: StreamConversionState,
): Array<ChatCompletionChunk> {
  if (!data) return []

  const parsed = JSON.parse(data) as Record<string, unknown>

  switch (parsed.type) {
    case "message_start": {
      return handleMessageStart(parsed, ss)
    }
    case "content_block_start": {
      return handleContentBlockStart(parsed, ss)
    }
    case "content_block_delta": {
      return handleContentBlockDelta(parsed, ss)
    }
    case "message_delta": {
      return handleMessageDelta(parsed, ss)
    }
    default: {
      return []
    }
  }
}

export async function* convertMessagesStreamToChatCompletionsStream(
  streamResponse: MessagesStream,
  model: string,
): AsyncIterable<MessagesBridgeStreamEvent> {
  const streamState = createStreamConversionState(model)

  for await (const chunk of streamResponse) {
    const eventType = chunk.event ?? ""
    const data = chunk.data ?? ""

    if (eventType === "ping") {
      yield { event: "ping", data: "{}" }
      continue
    }

    if (!data || eventType === "message_stop") {
      continue
    }

    const chatChunks = convertMessagesStreamEvent(eventType, data, streamState)
    for (const chatChunk of chatChunks) {
      yield { data: JSON.stringify(chatChunk) }
    }
  }

  yield { data: "[DONE]" }
}

// ==========================================
// Public Entry Point
// ==========================================

/**
 * Execute a chat completions request via the Messages API bridge.
 * Returns a Hono Response in the chat completions format.
 */
export async function executeThroughMessagesBridge(
  c: Context,
  payload: ChatCompletionsPayload,
): Promise<Response> {
  const messagesPayload = convertToMessagesPayload(payload)

  consola.debug(
    "Messages bridge: converting chat completions to messages API",
    JSON.stringify(messagesPayload).slice(-400),
  )
  logEmitter.log(
    "info",
    `Messages bridge: model=${payload.model} routed to /v1/messages API`,
  )

  const response = await createMessages(messagesPayload, undefined, {
    requestId: crypto.randomUUID(),
  })

  // Non-streaming
  if (!payload.stream) {
    const completion = convertMessagesResultToCompletion(
      response as AnthropicResponse,
    )
    return c.json(completion)
  }

  // Streaming
  const streamResponse = response as MessagesStream

  return streamSSE(
    c,
    async (stream: { writeSSE: (msg: SSEMessage) => Promise<void> }) => {
      for await (const chunk of convertMessagesStreamToChatCompletionsStream(
        streamResponse,
        payload.model,
      )) {
        await stream.writeSSE({
          data: chunk.data ?? "",
          event: chunk.event,
          id: typeof chunk.id === "string" ? chunk.id : undefined,
        })
      }
    },
  )
}
