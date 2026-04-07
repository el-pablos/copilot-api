/**
 * Unit Tests for Responses Translation Module
 *
 * Tests cover:
 * - THINKING_TEXT constant
 * - encodeCompactionCarrierSignature()
 * - decodeCompactionCarrierSignature()
 * - translateAnthropicMessagesToResponsesPayload()
 * - translateResponsesResultToAnthropic()
 */

import { describe, expect, it, mock, beforeEach } from "bun:test";

// Mock config module before importing the module under test
mock.module("~/lib/config", () => ({
  getExtraPromptForModel: (_model: string) => "",
  getReasoningEffortForModel: (_model: string) => "medium",
}));

import {
  THINKING_TEXT,
  encodeCompactionCarrierSignature,
  decodeCompactionCarrierSignature,
  translateAnthropicMessagesToResponsesPayload,
  translateResponsesResultToAnthropic,
} from "~/routes/messages/responses-translation";

import type { AnthropicMessagesPayload } from "~/routes/messages/anthropic-types";
import type { ResponsesResult } from "~/services/copilot/create-responses";

// ==========================================
// Test: THINKING_TEXT constant
// ==========================================

describe("THINKING_TEXT constant", () => {
  it("should be defined and equal to 'Thinking...'", () => {
    expect(THINKING_TEXT).toBe("Thinking...");
  });

  it("should be a non-empty string", () => {
    expect(typeof THINKING_TEXT).toBe("string");
    expect(THINKING_TEXT.length).toBeGreaterThan(0);
  });
});

// ==========================================
// Test: encodeCompactionCarrierSignature
// ==========================================

describe("encodeCompactionCarrierSignature", () => {
  it("should encode compaction carrier with correct format", () => {
    const compaction = {
      id: "test-id-123",
      encrypted_content: "encrypted-data-abc",
    };

    const result = encodeCompactionCarrierSignature(compaction);

    expect(result).toBe("cm1#encrypted-data-abc@test-id-123");
  });

  it("should handle empty id", () => {
    const compaction = {
      id: "",
      encrypted_content: "encrypted-data",
    };

    const result = encodeCompactionCarrierSignature(compaction);

    expect(result).toBe("cm1#encrypted-data@");
  });

  it("should handle empty encrypted_content", () => {
    const compaction = {
      id: "some-id",
      encrypted_content: "",
    };

    const result = encodeCompactionCarrierSignature(compaction);

    expect(result).toBe("cm1#@some-id");
  });

  it("should handle special characters in id and encrypted_content", () => {
    const compaction = {
      id: "id-with-special_chars.123",
      encrypted_content: "content+with/special=chars",
    };

    const result = encodeCompactionCarrierSignature(compaction);

    expect(result).toBe(
      "cm1#content+with/special=chars@id-with-special_chars.123",
    );
  });

  it("should handle very long strings", () => {
    const longContent = "a".repeat(10000);
    const longId = "b".repeat(1000);
    const compaction = {
      id: longId,
      encrypted_content: longContent,
    };

    const result = encodeCompactionCarrierSignature(compaction);

    expect(result).toBe(`cm1#${longContent}@${longId}`);
    expect(result.length).toBe(4 + 10000 + 1 + 1000); // cm1# + content + @ + id
  });
});

// ==========================================
// Test: decodeCompactionCarrierSignature
// ==========================================

describe("decodeCompactionCarrierSignature", () => {
  it("should decode valid compaction signature", () => {
    const signature = "cm1#encrypted-data-abc@test-id-123";

    const result = decodeCompactionCarrierSignature(signature);

    expect(result).toEqual({
      id: "test-id-123",
      encrypted_content: "encrypted-data-abc",
    });
  });

  it("should return undefined for signature without cm1# prefix", () => {
    const signature = "invalid-prefix@test-id";

    const result = decodeCompactionCarrierSignature(signature);

    expect(result).toBeUndefined();
  });

  it("should return undefined for signature without @ separator", () => {
    const signature = "cm1#encrypted-data-without-separator";

    const result = decodeCompactionCarrierSignature(signature);

    expect(result).toBeUndefined();
  });

  it("should return undefined for signature with @ at the start (no content)", () => {
    const signature = "cm1#@test-id";

    const result = decodeCompactionCarrierSignature(signature);

    expect(result).toBeUndefined();
  });

  it("should return undefined for signature with @ at the end (no id)", () => {
    const signature = "cm1#encrypted-content@";

    const result = decodeCompactionCarrierSignature(signature);

    expect(result).toBeUndefined();
  });

  it("should handle multiple @ symbols by using first occurrence", () => {
    const signature = "cm1#content@with@multiple@separators";

    const result = decodeCompactionCarrierSignature(signature);

    expect(result).toEqual({
      id: "with@multiple@separators",
      encrypted_content: "content",
    });
  });

  it("should return undefined for empty string", () => {
    const result = decodeCompactionCarrierSignature("");

    expect(result).toBeUndefined();
  });

  it("should return undefined for only prefix", () => {
    const result = decodeCompactionCarrierSignature("cm1#");

    expect(result).toBeUndefined();
  });

  it("should handle signature with special characters", () => {
    const signature =
      "cm1#content+with/special=chars@id-with-special_chars.123";

    const result = decodeCompactionCarrierSignature(signature);

    expect(result).toEqual({
      id: "id-with-special_chars.123",
      encrypted_content: "content+with/special=chars",
    });
  });

  it("should be inverse of encodeCompactionCarrierSignature", () => {
    const original = {
      id: "test-id-xyz",
      encrypted_content: "test-encrypted-content",
    };

    const encoded = encodeCompactionCarrierSignature(original);
    const decoded = decodeCompactionCarrierSignature(encoded);

    expect(decoded).toEqual(original);
  });
});

// ==========================================
// Test: translateAnthropicMessagesToResponsesPayload
// ==========================================

describe("translateAnthropicMessagesToResponsesPayload", () => {
  describe("basic message translation", () => {
    it("should translate simple user text message", () => {
      const payload: AnthropicMessagesPayload = {
        model: "claude-sonnet-4-20250514",
        messages: [
          {
            role: "user",
            content: "Hello, how are you?",
          },
        ],
        max_tokens: 1024,
      };

      const result = translateAnthropicMessagesToResponsesPayload(payload);

      expect(result.model).toBe("claude-sonnet-4-20250514");
      expect(result.input).toHaveLength(1);
      expect(result.input![0]).toEqual({
        type: "message",
        role: "user",
        content: "Hello, how are you?",
      });
    });

    it("should translate simple assistant text message", () => {
      const payload: AnthropicMessagesPayload = {
        model: "claude-sonnet-4-20250514",
        messages: [
          {
            role: "user",
            content: "Hello",
          },
          {
            role: "assistant",
            content: "Hi there!",
          },
        ],
        max_tokens: 1024,
      };

      const result = translateAnthropicMessagesToResponsesPayload(payload);

      expect(result.input).toHaveLength(2);
      expect(result.input![1]).toEqual({
        type: "message",
        role: "assistant",
        content: "Hi there!",
      });
    });

    it("should translate user message with array of text blocks", () => {
      const payload: AnthropicMessagesPayload = {
        model: "claude-sonnet-4-20250514",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "First part." },
              { type: "text", text: "Second part." },
            ],
          },
        ],
        max_tokens: 1024,
      };

      const result = translateAnthropicMessagesToResponsesPayload(payload);

      expect(result.input).toHaveLength(1);
      const message = result.input![0] as {
        content: Array<{ type: string; text: string }>;
      };
      expect(message.content).toHaveLength(2);
      expect(message.content[0]).toEqual({
        type: "input_text",
        text: "First part.",
      });
      expect(message.content[1]).toEqual({
        type: "input_text",
        text: "Second part.",
      });
    });

    it("should translate assistant message with array of text blocks", () => {
      const payload: AnthropicMessagesPayload = {
        model: "claude-sonnet-4-20250514",
        messages: [
          {
            role: "user",
            content: "Hi",
          },
          {
            role: "assistant",
            content: [{ type: "text", text: "Hello there!" }],
          },
        ],
        max_tokens: 1024,
      };

      const result = translateAnthropicMessagesToResponsesPayload(payload);

      expect(result.input).toHaveLength(2);
      const assistantMessage = result.input![1] as {
        content: Array<{ type: string; text: string }>;
      };
      expect(assistantMessage.content).toHaveLength(1);
      expect(assistantMessage.content[0]).toEqual({
        type: "output_text",
        text: "Hello there!",
      });
    });
  });

  describe("image content translation", () => {
    it("should translate user message with image block", () => {
      const payload: AnthropicMessagesPayload = {
        model: "claude-sonnet-4-20250514",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: "image/png",
                  data: "iVBORw0KGgoAAAANSUhEUg==",
                },
              },
              { type: "text", text: "What is in this image?" },
            ],
          },
        ],
        max_tokens: 1024,
      };

      const result = translateAnthropicMessagesToResponsesPayload(payload);

      const message = result.input![0] as { content: Array<unknown> };
      expect(message.content).toHaveLength(2);
      expect(message.content[0]).toEqual({
        type: "input_image",
        image_url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==",
        detail: "auto",
      });
    });
  });

  describe("tool use translation", () => {
    it("should translate assistant message with tool_use block", () => {
      const payload: AnthropicMessagesPayload = {
        model: "claude-sonnet-4-20250514",
        messages: [
          {
            role: "user",
            content: "Get the weather",
          },
          {
            role: "assistant",
            content: [
              {
                type: "tool_use",
                id: "tool_call_123",
                name: "get_weather",
                input: { location: "Tokyo" },
              },
            ],
          },
        ],
        max_tokens: 1024,
      };

      const result = translateAnthropicMessagesToResponsesPayload(payload);

      expect(result.input).toHaveLength(2);
      expect(result.input![1]).toEqual({
        type: "function_call",
        call_id: "tool_call_123",
        name: "get_weather",
        arguments: '{"location":"Tokyo"}',
        status: "completed",
      });
    });

    it("should translate user message with tool_result block", () => {
      const payload: AnthropicMessagesPayload = {
        model: "claude-sonnet-4-20250514",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "tool_result",
                tool_use_id: "tool_call_123",
                content: "The weather in Tokyo is sunny, 25C",
              },
            ],
          },
        ],
        max_tokens: 1024,
      };

      const result = translateAnthropicMessagesToResponsesPayload(payload);

      expect(result.input![0]).toEqual({
        type: "function_call_output",
        call_id: "tool_call_123",
        output: "The weather in Tokyo is sunny, 25C",
        status: "completed",
      });
    });

    it("should translate tool_result with is_error flag", () => {
      const payload: AnthropicMessagesPayload = {
        model: "claude-sonnet-4-20250514",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "tool_result",
                tool_use_id: "tool_call_456",
                content: "Error: API unavailable",
                is_error: true,
              },
            ],
          },
        ],
        max_tokens: 1024,
      };

      const result = translateAnthropicMessagesToResponsesPayload(payload);

      expect(result.input![0]).toEqual({
        type: "function_call_output",
        call_id: "tool_call_456",
        output: "Error: API unavailable",
        status: "incomplete",
      });
    });

    it("should translate tool_result with array content", () => {
      const payload: AnthropicMessagesPayload = {
        model: "claude-sonnet-4-20250514",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "tool_result",
                tool_use_id: "tool_call_789",
                content: [{ type: "text", text: "Result data" }],
              },
            ],
          },
        ],
        max_tokens: 1024,
      };

      const result = translateAnthropicMessagesToResponsesPayload(payload);

      const output = result.input![0] as {
        output: Array<{ type: string; text: string }>;
      };
      expect(output.output).toHaveLength(1);
      expect(output.output[0]).toEqual({
        type: "input_text",
        text: "Result data",
      });
    });
  });

  describe("thinking block translation", () => {
    it("should translate assistant message with thinking block containing signature", () => {
      const payload: AnthropicMessagesPayload = {
        model: "claude-sonnet-4-20250514",
        messages: [
          {
            role: "user",
            content: "Think about this",
          },
          {
            role: "assistant",
            content: [
              {
                type: "thinking",
                thinking: "Let me think...",
                signature: "encrypted_content_data@reasoning-id-123",
              },
              { type: "text", text: "Here is my response" },
            ],
          },
        ],
        max_tokens: 1024,
      };

      const result = translateAnthropicMessagesToResponsesPayload(payload);

      expect(result.input!.length).toBeGreaterThan(1);
      // Check for reasoning content
      const reasoningItem = result.input!.find(
        (item) => (item as { type: string }).type === "reasoning",
      );
      expect(reasoningItem).toBeDefined();
    });

    it("should translate thinking block with compaction signature", () => {
      const payload: AnthropicMessagesPayload = {
        model: "claude-sonnet-4-20250514",
        messages: [
          {
            role: "user",
            content: "Hello",
          },
          {
            role: "assistant",
            content: [
              {
                type: "thinking",
                thinking: "Thinking...",
                signature: "cm1#encrypted-content@compaction-id",
              },
            ],
          },
        ],
        max_tokens: 1024,
      };

      const result = translateAnthropicMessagesToResponsesPayload(payload);

      const compactionItem = result.input!.find(
        (item) => (item as { type: string }).type === "compaction",
      );
      expect(compactionItem).toBeDefined();
      expect(compactionItem).toEqual({
        id: "compaction-id",
        type: "compaction",
        encrypted_content: "encrypted-content",
      });
    });
  });

  describe("system prompt translation", () => {
    it("should translate string system prompt to instructions", () => {
      const payload: AnthropicMessagesPayload = {
        model: "claude-sonnet-4-20250514",
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 1024,
        system: "You are a helpful assistant.",
      };

      const result = translateAnthropicMessagesToResponsesPayload(payload);

      expect(result.instructions).toBe("You are a helpful assistant.");
    });

    it("should translate array system prompt to instructions", () => {
      const payload: AnthropicMessagesPayload = {
        model: "claude-sonnet-4-20250514",
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 1024,
        system: [
          { type: "text", text: "First instruction." },
          { type: "text", text: "Second instruction." },
        ],
      };

      const result = translateAnthropicMessagesToResponsesPayload(payload);

      expect(result.instructions).toContain("First instruction.");
      expect(result.instructions).toContain("Second instruction.");
    });

    it("should handle undefined system prompt", () => {
      const payload: AnthropicMessagesPayload = {
        model: "claude-sonnet-4-20250514",
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 1024,
      };

      const result = translateAnthropicMessagesToResponsesPayload(payload);

      expect(result.instructions).toBeNull();
    });
  });

  describe("tools translation", () => {
    it("should translate Anthropic tools to function tools", () => {
      const payload: AnthropicMessagesPayload = {
        model: "claude-sonnet-4-20250514",
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 1024,
        tools: [
          {
            name: "get_weather",
            description: "Get current weather",
            input_schema: {
              type: "object",
              properties: {
                location: { type: "string" },
              },
              required: ["location"],
            },
          },
        ],
      };

      const result = translateAnthropicMessagesToResponsesPayload(payload);

      expect(result.tools).toHaveLength(1);
      expect(result.tools![0]).toEqual({
        type: "function",
        name: "get_weather",
        description: "Get current weather",
        parameters: {
          type: "object",
          properties: {
            location: { type: "string" },
          },
          required: ["location"],
        },
        strict: false,
      });
    });

    it("should normalize tool schema without properties", () => {
      const payload: AnthropicMessagesPayload = {
        model: "claude-sonnet-4-20250514",
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 1024,
        tools: [
          {
            name: "no_params",
            input_schema: {
              type: "object",
            },
          },
        ],
      };

      const result = translateAnthropicMessagesToResponsesPayload(payload);

      expect(result.tools![0]).toMatchObject({
        name: "no_params",
        parameters: {
          type: "object",
          properties: {},
        },
      });
    });

    it("should handle empty tools array", () => {
      const payload: AnthropicMessagesPayload = {
        model: "claude-sonnet-4-20250514",
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 1024,
        tools: [],
      };

      const result = translateAnthropicMessagesToResponsesPayload(payload);

      expect(result.tools).toBeNull();
    });

    it("should handle undefined tools", () => {
      const payload: AnthropicMessagesPayload = {
        model: "claude-sonnet-4-20250514",
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 1024,
      };

      const result = translateAnthropicMessagesToResponsesPayload(payload);

      expect(result.tools).toBeNull();
    });
  });

  describe("tool_choice translation", () => {
    it("should translate auto tool_choice", () => {
      const payload: AnthropicMessagesPayload = {
        model: "claude-sonnet-4-20250514",
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 1024,
        tool_choice: { type: "auto" },
      };

      const result = translateAnthropicMessagesToResponsesPayload(payload);

      expect(result.tool_choice).toBe("auto");
    });

    it("should translate any tool_choice to required", () => {
      const payload: AnthropicMessagesPayload = {
        model: "claude-sonnet-4-20250514",
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 1024,
        tool_choice: { type: "any" },
      };

      const result = translateAnthropicMessagesToResponsesPayload(payload);

      expect(result.tool_choice).toBe("required");
    });

    it("should translate tool tool_choice with name", () => {
      const payload: AnthropicMessagesPayload = {
        model: "claude-sonnet-4-20250514",
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 1024,
        tool_choice: { type: "tool", name: "get_weather" },
      };

      const result = translateAnthropicMessagesToResponsesPayload(payload);

      expect(result.tool_choice).toEqual({
        type: "function",
        name: "get_weather",
      });
    });

    it("should translate none tool_choice", () => {
      const payload: AnthropicMessagesPayload = {
        model: "claude-sonnet-4-20250514",
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 1024,
        tool_choice: { type: "none" },
      };

      const result = translateAnthropicMessagesToResponsesPayload(payload);

      expect(result.tool_choice).toBe("none");
    });

    it("should default to auto when tool_choice is undefined", () => {
      const payload: AnthropicMessagesPayload = {
        model: "claude-sonnet-4-20250514",
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 1024,
      };

      const result = translateAnthropicMessagesToResponsesPayload(payload);

      expect(result.tool_choice).toBe("auto");
    });
  });

  describe("metadata translation", () => {
    it("should extract session_id from metadata user_id", () => {
      const payload: AnthropicMessagesPayload = {
        model: "claude-sonnet-4-20250514",
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 1024,
        metadata: {
          user_id:
            '{"session_id":"session-123","safety_identifier":"safe-456"}',
        },
      };

      const result = translateAnthropicMessagesToResponsesPayload(payload);

      expect(result.prompt_cache_key).toBe("session-123");
    });

    it("should extract session_id from legacy format", () => {
      const payload: AnthropicMessagesPayload = {
        model: "claude-sonnet-4-20250514",
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 1024,
        metadata: {
          user_id: "user_safe123_account_session_sess456",
        },
      };

      const result = translateAnthropicMessagesToResponsesPayload(payload);

      expect(result.prompt_cache_key).toBe("sess456");
    });

    it("should handle missing metadata", () => {
      const payload: AnthropicMessagesPayload = {
        model: "claude-sonnet-4-20250514",
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 1024,
      };

      const result = translateAnthropicMessagesToResponsesPayload(payload);

      expect(result.prompt_cache_key).toBeNull();
    });
  });

  describe("edge cases", () => {
    it("should handle empty messages array", () => {
      const payload: AnthropicMessagesPayload = {
        model: "claude-sonnet-4-20250514",
        messages: [],
        max_tokens: 1024,
      };

      const result = translateAnthropicMessagesToResponsesPayload(payload);

      expect(result.input).toEqual([]);
    });

    it("should ensure max_output_tokens is at least 12800", () => {
      const payload: AnthropicMessagesPayload = {
        model: "claude-sonnet-4-20250514",
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 100,
      };

      const result = translateAnthropicMessagesToResponsesPayload(payload);

      expect(result.max_output_tokens).toBe(12800);
    });

    it("should preserve max_tokens when greater than 12800", () => {
      const payload: AnthropicMessagesPayload = {
        model: "claude-sonnet-4-20250514",
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 20000,
      };

      const result = translateAnthropicMessagesToResponsesPayload(payload);

      expect(result.max_output_tokens).toBe(20000);
    });

    it("should set temperature to 1 for reasoning models", () => {
      const payload: AnthropicMessagesPayload = {
        model: "claude-sonnet-4-20250514",
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 1024,
        temperature: 0.5,
      };

      const result = translateAnthropicMessagesToResponsesPayload(payload);

      expect(result.temperature).toBe(1);
    });

    it("should include reasoning configuration", () => {
      const payload: AnthropicMessagesPayload = {
        model: "claude-sonnet-4-20250514",
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 1024,
      };

      const result = translateAnthropicMessagesToResponsesPayload(payload);

      expect(result.reasoning).toEqual({
        effort: "medium",
        summary: "detailed",
      });
    });

    it("should include reasoning.encrypted_content in include array", () => {
      const payload: AnthropicMessagesPayload = {
        model: "claude-sonnet-4-20250514",
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 1024,
      };

      const result = translateAnthropicMessagesToResponsesPayload(payload);

      expect(result.include).toContain("reasoning.encrypted_content");
    });
  });
});

// ==========================================
// Test: translateResponsesResultToAnthropic
// ==========================================

describe("translateResponsesResultToAnthropic", () => {
  const createBaseResult = (
    overrides: Partial<ResponsesResult> = {},
  ): ResponsesResult => ({
    id: "resp_123",
    object: "response",
    created_at: 1704067200,
    model: "claude-sonnet-4-20250514",
    output: [],
    output_text: "",
    status: "completed",
    usage: {
      input_tokens: 100,
      output_tokens: 50,
      total_tokens: 150,
    },
    error: null,
    incomplete_details: null,
    instructions: null,
    metadata: null,
    parallel_tool_calls: true,
    temperature: 1,
    tool_choice: "auto",
    tools: [],
    top_p: null,
    ...overrides,
  });

  describe("basic response translation", () => {
    it("should translate empty output with output_text fallback", () => {
      const result = createBaseResult({
        output: [],
        output_text: "Hello, I am Claude!",
      });

      const response = translateResponsesResultToAnthropic(result);

      expect(response.id).toBe("resp_123");
      expect(response.type).toBe("message");
      expect(response.role).toBe("assistant");
      expect(response.model).toBe("claude-sonnet-4-20250514");
      expect(response.content).toHaveLength(1);
      expect(response.content[0]).toEqual({
        type: "text",
        text: "Hello, I am Claude!",
      });
    });

    it("should translate message output with text content", () => {
      const result = createBaseResult({
        output: [
          {
            id: "msg_123",
            type: "message",
            role: "assistant",
            status: "completed",
            content: [
              {
                type: "output_text",
                text: "Hello from message!",
                annotations: [],
              },
            ],
          },
        ],
      });

      const response = translateResponsesResultToAnthropic(result);

      expect(response.content).toHaveLength(1);
      expect(response.content[0]).toEqual({
        type: "text",
        text: "Hello from message!",
      });
    });

    it("should combine multiple text content blocks", () => {
      const result = createBaseResult({
        output: [
          {
            id: "msg_123",
            type: "message",
            role: "assistant",
            status: "completed",
            content: [
              { type: "output_text", text: "First part. ", annotations: [] },
              { type: "output_text", text: "Second part.", annotations: [] },
            ],
          },
        ],
      });

      const response = translateResponsesResultToAnthropic(result);

      expect(response.content).toHaveLength(1);
      expect(response.content[0]).toEqual({
        type: "text",
        text: "First part. Second part.",
      });
    });
  });

  describe("reasoning output translation", () => {
    it("should translate reasoning output to thinking block", () => {
      const result = createBaseResult({
        output: [
          {
            id: "reasoning_123",
            type: "reasoning",
            summary: [
              { type: "summary_text", text: "Let me think about this..." },
            ],
            encrypted_content: "encrypted_data",
            status: "completed",
          },
        ],
      });

      const response = translateResponsesResultToAnthropic(result);

      expect(response.content).toHaveLength(1);
      expect(response.content[0]).toEqual({
        type: "thinking",
        thinking: "Let me think about this...",
        signature: "encrypted_data@reasoning_123",
      });
    });

    it("should use THINKING_TEXT when reasoning summary is empty", () => {
      const result = createBaseResult({
        output: [
          {
            id: "reasoning_123",
            type: "reasoning",
            summary: [],
            encrypted_content: "encrypted_data",
            status: "completed",
          },
        ],
      });

      const response = translateResponsesResultToAnthropic(result);

      expect(response.content[0]).toEqual({
        type: "thinking",
        thinking: THINKING_TEXT,
        signature: "encrypted_data@reasoning_123",
      });
    });

    it("should use THINKING_TEXT when summary is undefined", () => {
      const result = createBaseResult({
        output: [
          {
            id: "reasoning_123",
            type: "reasoning",
            encrypted_content: "encrypted_data",
            status: "completed",
          },
        ],
      });

      const response = translateResponsesResultToAnthropic(result);

      expect(response.content[0]).toMatchObject({
        type: "thinking",
        thinking: THINKING_TEXT,
      });
    });
  });

  describe("function call output translation", () => {
    it("should translate function_call output to tool_use block", () => {
      const result = createBaseResult({
        output: [
          {
            id: "call_123",
            type: "function_call",
            call_id: "tool_call_456",
            name: "get_weather",
            arguments: '{"location":"Tokyo"}',
            status: "completed",
          },
        ],
      });

      const response = translateResponsesResultToAnthropic(result);

      expect(response.content).toHaveLength(1);
      expect(response.content[0]).toEqual({
        type: "tool_use",
        id: "tool_call_456",
        name: "get_weather",
        input: { location: "Tokyo" },
      });
    });

    it("should handle invalid JSON arguments gracefully", () => {
      const result = createBaseResult({
        output: [
          {
            id: "call_123",
            type: "function_call",
            call_id: "tool_call_456",
            name: "get_weather",
            arguments: "not-valid-json",
            status: "completed",
          },
        ],
      });

      const response = translateResponsesResultToAnthropic(result);

      expect(response.content[0]).toEqual({
        type: "tool_use",
        id: "tool_call_456",
        name: "get_weather",
        input: { raw_arguments: "not-valid-json" },
      });
    });

    it("should handle empty arguments string", () => {
      const result = createBaseResult({
        output: [
          {
            id: "call_123",
            type: "function_call",
            call_id: "tool_call_456",
            name: "no_args_function",
            arguments: "",
            status: "completed",
          },
        ],
      });

      const response = translateResponsesResultToAnthropic(result);

      expect(response.content[0]).toMatchObject({
        input: {},
      });
    });

    it("should wrap array arguments", () => {
      const result = createBaseResult({
        output: [
          {
            id: "call_123",
            type: "function_call",
            call_id: "tool_call_456",
            name: "array_function",
            arguments: '["item1","item2"]',
            status: "completed",
          },
        ],
      });

      const response = translateResponsesResultToAnthropic(result);

      expect(response.content[0]).toMatchObject({
        input: { arguments: ["item1", "item2"] },
      });
    });

    it("should skip function_call without name", () => {
      const result = createBaseResult({
        output: [
          {
            id: "call_123",
            type: "function_call",
            call_id: "tool_call_456",
            name: "",
            arguments: "{}",
            status: "completed",
          },
        ],
      });

      const response = translateResponsesResultToAnthropic(result);

      expect(response.content).toHaveLength(0);
    });
  });

  describe("compaction output translation", () => {
    it("should translate compaction output to thinking block with encoded signature", () => {
      const result = createBaseResult({
        output: [
          {
            id: "compaction_123",
            type: "compaction",
            encrypted_content: "compacted_content_data",
          },
        ],
      });

      const response = translateResponsesResultToAnthropic(result);

      expect(response.content).toHaveLength(1);
      expect(response.content[0]).toEqual({
        type: "thinking",
        thinking: THINKING_TEXT,
        signature: "cm1#compacted_content_data@compaction_123",
      });
    });

    it("should skip compaction without id", () => {
      const result = createBaseResult({
        output: [
          {
            id: "",
            type: "compaction",
            encrypted_content: "compacted_content_data",
          },
        ],
      });

      const response = translateResponsesResultToAnthropic(result);

      expect(response.content).toHaveLength(0);
    });

    it("should skip compaction without encrypted_content", () => {
      const result = createBaseResult({
        output: [
          {
            id: "compaction_123",
            type: "compaction",
            encrypted_content: "",
          },
        ],
      });

      const response = translateResponsesResultToAnthropic(result);

      expect(response.content).toHaveLength(0);
    });
  });

  describe("refusal output translation", () => {
    it("should translate refusal content to text", () => {
      const result = createBaseResult({
        output: [
          {
            id: "msg_123",
            type: "message",
            role: "assistant",
            status: "completed",
            content: [
              {
                type: "refusal",
                refusal: "I cannot help with that request.",
              },
            ],
          },
        ],
      });

      const response = translateResponsesResultToAnthropic(result);

      expect(response.content[0]).toEqual({
        type: "text",
        text: "I cannot help with that request.",
      });
    });
  });

  describe("stop reason mapping", () => {
    it("should map completed status to end_turn", () => {
      const result = createBaseResult({
        status: "completed",
        output: [],
      });

      const response = translateResponsesResultToAnthropic(result);

      expect(response.stop_reason).toBe("end_turn");
    });

    it("should map completed with function_call to tool_use", () => {
      const result = createBaseResult({
        status: "completed",
        output: [
          {
            id: "call_123",
            type: "function_call",
            call_id: "tool_456",
            name: "get_weather",
            arguments: "{}",
            status: "completed",
          },
        ],
      });

      const response = translateResponsesResultToAnthropic(result);

      expect(response.stop_reason).toBe("tool_use");
    });

    it("should map incomplete with max_output_tokens to max_tokens", () => {
      const result = createBaseResult({
        status: "incomplete",
        incomplete_details: { reason: "max_output_tokens" },
      });

      const response = translateResponsesResultToAnthropic(result);

      expect(response.stop_reason).toBe("max_tokens");
    });

    it("should map incomplete with content_filter to end_turn", () => {
      const result = createBaseResult({
        status: "incomplete",
        incomplete_details: { reason: "content_filter" },
      });

      const response = translateResponsesResultToAnthropic(result);

      expect(response.stop_reason).toBe("end_turn");
    });

    it("should map unknown status to null", () => {
      const result = createBaseResult({
        status: "unknown_status",
      });

      const response = translateResponsesResultToAnthropic(result);

      expect(response.stop_reason).toBeNull();
    });
  });

  describe("usage mapping", () => {
    it("should map basic usage correctly", () => {
      const result = createBaseResult({
        usage: {
          input_tokens: 100,
          output_tokens: 50,
          total_tokens: 150,
        },
      });

      const response = translateResponsesResultToAnthropic(result);

      expect(response.usage).toEqual({
        input_tokens: 100,
        output_tokens: 50,
      });
    });

    it("should subtract cached tokens from input_tokens", () => {
      const result = createBaseResult({
        usage: {
          input_tokens: 100,
          output_tokens: 50,
          total_tokens: 150,
          input_tokens_details: {
            cached_tokens: 30,
          },
        },
      });

      const response = translateResponsesResultToAnthropic(result);

      expect(response.usage).toEqual({
        input_tokens: 70,
        output_tokens: 50,
        cache_read_input_tokens: 30,
      });
    });

    it("should handle undefined usage", () => {
      const result = createBaseResult({
        usage: undefined,
      });

      const response = translateResponsesResultToAnthropic(result);

      expect(response.usage).toEqual({
        input_tokens: 0,
        output_tokens: 0,
      });
    });

    it("should handle null usage", () => {
      const result = createBaseResult({
        usage: null,
      });

      const response = translateResponsesResultToAnthropic(result);

      expect(response.usage).toEqual({
        input_tokens: 0,
        output_tokens: 0,
      });
    });
  });

  describe("edge cases", () => {
    it("should handle empty output and empty output_text", () => {
      const result = createBaseResult({
        output: [],
        output_text: "",
      });

      const response = translateResponsesResultToAnthropic(result);

      expect(response.content).toEqual([]);
    });

    it("should handle mixed output types", () => {
      const result = createBaseResult({
        output: [
          {
            id: "reasoning_1",
            type: "reasoning",
            summary: [{ type: "summary_text", text: "Thinking..." }],
            encrypted_content: "enc1",
            status: "completed",
          },
          {
            id: "msg_1",
            type: "message",
            role: "assistant",
            status: "completed",
            content: [
              { type: "output_text", text: "Response text", annotations: [] },
            ],
          },
          {
            id: "call_1",
            type: "function_call",
            call_id: "tool_1",
            name: "some_tool",
            arguments: '{"arg":"value"}',
            status: "completed",
          },
        ],
      });

      const response = translateResponsesResultToAnthropic(result);

      expect(response.content).toHaveLength(3);
      expect(response.content[0].type).toBe("thinking");
      expect(response.content[1].type).toBe("text");
      expect(response.content[2].type).toBe("tool_use");
    });

    it("should set stop_sequence to null", () => {
      const result = createBaseResult();

      const response = translateResponsesResultToAnthropic(result);

      expect(response.stop_sequence).toBeNull();
    });

    it("should preserve response id", () => {
      const result = createBaseResult({
        id: "custom_response_id_12345",
      });

      const response = translateResponsesResultToAnthropic(result);

      expect(response.id).toBe("custom_response_id_12345");
    });

    it("should preserve model name", () => {
      const result = createBaseResult({
        model: "custom-model-name",
      });

      const response = translateResponsesResultToAnthropic(result);

      expect(response.model).toBe("custom-model-name");
    });
  });
});

// ==========================================
// Test: Round-trip encoding/decoding
// ==========================================

describe("Round-trip encoding and decoding", () => {
  it("should preserve data through encode-decode cycle for various inputs", () => {
    const testCases = [
      { id: "simple-id", encrypted_content: "simple-content" },
      {
        id: "id_with_underscores",
        encrypted_content: "content_with_underscores",
      },
      {
        id: "id-with-dashes-123",
        encrypted_content: "content-with-dashes-456",
      },
      { id: "mixed.id_test-123", encrypted_content: "base64+encoded/data==" },
    ];

    for (const original of testCases) {
      const encoded = encodeCompactionCarrierSignature(original);
      const decoded = decodeCompactionCarrierSignature(encoded);

      expect(decoded).toEqual(original);
    }
  });
});
