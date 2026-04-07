import { beforeEach, describe, expect, it } from "bun:test";

import type {
  ResponseCompletedEvent,
  ResponseCreatedEvent,
  ResponseErrorEvent,
  ResponseFailedEvent,
  ResponseFunctionCallArgumentsDeltaEvent,
  ResponseFunctionCallArgumentsDoneEvent,
  ResponseIncompleteEvent,
  ResponseOutputItemAddedEvent,
  ResponseOutputItemDoneEvent,
  ResponseReasoningSummaryTextDeltaEvent,
  ResponseReasoningSummaryTextDoneEvent,
  ResponsesResult,
  ResponseStreamEvent,
  ResponseTextDeltaEvent,
  ResponseTextDoneEvent,
} from "~/services/copilot/create-responses";

import type { AnthropicStreamEventData } from "~/routes/messages/anthropic-types";

import {
  buildErrorEvent,
  createResponsesStreamState,
  translateResponsesStreamEvent,
  type ResponsesStreamState,
} from "~/routes/messages/responses-stream-translation";

// Helper to create a base ResponsesResult
function createBaseResponse(
  overrides: Partial<ResponsesResult> = {},
): ResponsesResult {
  return {
    id: "resp_test_123",
    object: "response",
    created_at: Date.now(),
    model: "gpt-4o",
    output: [],
    output_text: "",
    status: "completed",
    usage: {
      input_tokens: 100,
      output_tokens: 50,
      total_tokens: 150,
      input_tokens_details: {
        cached_tokens: 20,
      },
    },
    error: null,
    incomplete_details: null,
    instructions: null,
    metadata: null,
    parallel_tool_calls: true,
    temperature: null,
    tool_choice: null,
    tools: [],
    top_p: null,
    ...overrides,
  };
}

// Helper to find specific event type
function findEvent<T extends AnthropicStreamEventData["type"]>(
  events: Array<AnthropicStreamEventData>,
  type: T,
): Extract<AnthropicStreamEventData, { type: T }> | undefined {
  return events.find((e) => e.type === type) as
    | Extract<AnthropicStreamEventData, { type: T }>
    | undefined;
}

// Helper to find all events of a specific type
function findEvents<T extends AnthropicStreamEventData["type"]>(
  events: Array<AnthropicStreamEventData>,
  type: T,
): Array<Extract<AnthropicStreamEventData, { type: T }>> {
  return events.filter((e) => e.type === type) as Array<
    Extract<AnthropicStreamEventData, { type: T }>
  >;
}

describe("createResponsesStreamState", () => {
  it("should return initial state with correct default values", () => {
    const state = createResponsesStreamState();

    expect(state.messageStartSent).toBe(false);
    expect(state.messageCompleted).toBe(false);
    expect(state.nextContentBlockIndex).toBe(0);
    expect(state.blockIndexByKey).toBeInstanceOf(Map);
    expect(state.blockIndexByKey.size).toBe(0);
    expect(state.openBlocks).toBeInstanceOf(Set);
    expect(state.openBlocks.size).toBe(0);
    expect(state.blockHasDelta).toBeInstanceOf(Set);
    expect(state.blockHasDelta.size).toBe(0);
    expect(state.functionCallStateByOutputIndex).toBeInstanceOf(Map);
    expect(state.functionCallStateByOutputIndex.size).toBe(0);
  });

  it("should create independent state instances", () => {
    const state1 = createResponsesStreamState();
    const state2 = createResponsesStreamState();

    state1.messageStartSent = true;
    state1.blockIndexByKey.set("test", 1);

    expect(state2.messageStartSent).toBe(false);
    expect(state2.blockIndexByKey.size).toBe(0);
  });
});

describe("buildErrorEvent", () => {
  it("should return error event with correct structure", () => {
    const errorEvent = buildErrorEvent("Something went wrong");

    expect(errorEvent.type).toBe("error");
    expect(errorEvent.error).toEqual({
      type: "api_error",
      message: "Something went wrong",
    });
  });

  it("should handle empty error message", () => {
    const errorEvent = buildErrorEvent("");

    expect(errorEvent.type).toBe("error");
    expect(errorEvent.error.message).toBe("");
  });

  it("should handle long error messages", () => {
    const longMessage = "Error: ".repeat(100);
    const errorEvent = buildErrorEvent(longMessage);

    expect(errorEvent.error.message).toBe(longMessage);
  });

  it("should handle special characters in error message", () => {
    const specialMessage = 'Error with "quotes" and <tags> & symbols';
    const errorEvent = buildErrorEvent(specialMessage);

    expect(errorEvent.error.message).toBe(specialMessage);
  });
});

describe("translateResponsesStreamEvent", () => {
  let state: ResponsesStreamState;

  beforeEach(() => {
    state = createResponsesStreamState();
  });

  describe("response.created event", () => {
    it("should emit message_start event", () => {
      const event: ResponseCreatedEvent = {
        type: "response.created",
        response: createBaseResponse(),
        sequence_number: 0,
      };

      const events = translateResponsesStreamEvent(event, state);

      const messageStart = findEvent(events, "message_start");
      expect(messageStart).toBeDefined();
      expect(messageStart?.message.id).toBe("resp_test_123");
      expect(messageStart?.message.role).toBe("assistant");
      expect(messageStart?.message.model).toBe("gpt-4o");
      expect(state.messageStartSent).toBe(true);
    });

    it("should calculate input_tokens excluding cached tokens", () => {
      const event: ResponseCreatedEvent = {
        type: "response.created",
        response: createBaseResponse({
          usage: {
            input_tokens: 100,
            output_tokens: 50,
            total_tokens: 150,
            input_tokens_details: { cached_tokens: 30 },
          },
        }),
        sequence_number: 0,
      };

      const events = translateResponsesStreamEvent(event, state);
      const messageStart = findEvent(events, "message_start");

      expect(messageStart?.message.usage.input_tokens).toBe(70); // 100 - 30
      expect(messageStart?.message.usage.cache_read_input_tokens).toBe(30);
    });

    it("should handle missing cached_tokens", () => {
      const event: ResponseCreatedEvent = {
        type: "response.created",
        response: createBaseResponse({
          usage: {
            input_tokens: 100,
            output_tokens: 50,
            total_tokens: 150,
          },
        }),
        sequence_number: 0,
      };

      const events = translateResponsesStreamEvent(event, state);
      const messageStart = findEvent(events, "message_start");

      expect(messageStart?.message.usage.input_tokens).toBe(100);
      expect(messageStart?.message.usage.cache_read_input_tokens).toBe(0);
    });

    it("should handle missing usage", () => {
      const event: ResponseCreatedEvent = {
        type: "response.created",
        response: createBaseResponse({ usage: null }),
        sequence_number: 0,
      };

      const events = translateResponsesStreamEvent(event, state);
      const messageStart = findEvent(events, "message_start");

      expect(messageStart?.message.usage.input_tokens).toBe(0);
      expect(messageStart?.message.usage.output_tokens).toBe(0);
    });
  });

  describe("response.output_item.added event", () => {
    it("should open function call block for function_call item", () => {
      const event: ResponseOutputItemAddedEvent = {
        type: "response.output_item.added",
        item: {
          id: "call_123",
          type: "function_call",
          call_id: "tool_abc",
          name: "search",
          arguments: "",
        },
        output_index: 0,
        sequence_number: 1,
      };

      const events = translateResponsesStreamEvent(event, state);

      const blockStart = findEvent(events, "content_block_start");
      expect(blockStart).toBeDefined();
      expect(blockStart?.content_block.type).toBe("tool_use");
      if (blockStart?.content_block.type === "tool_use") {
        expect(blockStart.content_block.id).toBe("tool_abc");
        expect(blockStart.content_block.name).toBe("search");
      }
    });

    it("should handle function_call with initial arguments", () => {
      const event: ResponseOutputItemAddedEvent = {
        type: "response.output_item.added",
        item: {
          id: "call_123",
          type: "function_call",
          call_id: "tool_abc",
          name: "search",
          arguments: '{"query": "test"}',
        },
        output_index: 0,
        sequence_number: 1,
      };

      const events = translateResponsesStreamEvent(event, state);

      const deltas = findEvents(events, "content_block_delta");
      const jsonDelta = deltas.find((e) => e.delta.type === "input_json_delta");
      expect(jsonDelta).toBeDefined();
      if (jsonDelta?.delta.type === "input_json_delta") {
        expect(jsonDelta.delta.partial_json).toBe('{"query": "test"}');
      }
    });

    it("should not emit events for non-function_call items", () => {
      const event: ResponseOutputItemAddedEvent = {
        type: "response.output_item.added",
        item: {
          id: "msg_123",
          type: "message",
          role: "assistant",
          status: "in_progress",
          content: [],
        },
        output_index: 0,
        sequence_number: 1,
      };

      const events = translateResponsesStreamEvent(event, state);

      expect(events).toHaveLength(0);
    });
  });

  describe("response.output_text.delta event", () => {
    it("should open text block and emit text delta", () => {
      const event: ResponseTextDeltaEvent = {
        type: "response.output_text.delta",
        delta: "Hello, world!",
        item_id: "item_123",
        output_index: 0,
        content_index: 0,
        sequence_number: 1,
      };

      const events = translateResponsesStreamEvent(event, state);

      const blockStart = findEvent(events, "content_block_start");
      expect(blockStart).toBeDefined();
      expect(blockStart?.content_block.type).toBe("text");

      const delta = findEvent(events, "content_block_delta");
      expect(delta).toBeDefined();
      if (delta?.delta.type === "text_delta") {
        expect(delta.delta.text).toBe("Hello, world!");
      }
    });

    it("should reuse existing text block for same output_index and content_index", () => {
      const event1: ResponseTextDeltaEvent = {
        type: "response.output_text.delta",
        delta: "Hello, ",
        item_id: "item_123",
        output_index: 0,
        content_index: 0,
        sequence_number: 1,
      };
      const event2: ResponseTextDeltaEvent = {
        type: "response.output_text.delta",
        delta: "world!",
        item_id: "item_123",
        output_index: 0,
        content_index: 0,
        sequence_number: 2,
      };

      translateResponsesStreamEvent(event1, state);
      const events = translateResponsesStreamEvent(event2, state);

      // Second call should not have block start, only delta
      const blockStarts = findEvents(events, "content_block_start");
      expect(blockStarts).toHaveLength(0);

      const delta = findEvent(events, "content_block_delta");
      expect(delta).toBeDefined();
    });

    it("should not emit events for empty delta", () => {
      const event: ResponseTextDeltaEvent = {
        type: "response.output_text.delta",
        delta: "",
        item_id: "item_123",
        output_index: 0,
        content_index: 0,
        sequence_number: 1,
      };

      const events = translateResponsesStreamEvent(event, state);

      expect(events).toHaveLength(0);
    });
  });

  describe("response.output_text.done event", () => {
    it("should emit text delta if block has no prior delta", () => {
      const event: ResponseTextDoneEvent = {
        type: "response.output_text.done",
        text: "Complete text",
        item_id: "item_123",
        output_index: 0,
        content_index: 0,
        sequence_number: 1,
      };

      const events = translateResponsesStreamEvent(event, state);

      const delta = findEvent(events, "content_block_delta");
      expect(delta).toBeDefined();
      if (delta?.delta.type === "text_delta") {
        expect(delta.delta.text).toBe("Complete text");
      }
    });

    it("should not emit text delta if block already has delta", () => {
      // First send a delta
      const deltaEvent: ResponseTextDeltaEvent = {
        type: "response.output_text.delta",
        delta: "Partial",
        item_id: "item_123",
        output_index: 0,
        content_index: 0,
        sequence_number: 1,
      };
      translateResponsesStreamEvent(deltaEvent, state);

      // Then send done
      const doneEvent: ResponseTextDoneEvent = {
        type: "response.output_text.done",
        text: "Partial text",
        item_id: "item_123",
        output_index: 0,
        content_index: 0,
        sequence_number: 2,
      };

      const events = translateResponsesStreamEvent(doneEvent, state);

      // Should not have text_delta since delta was already sent
      const deltas = findEvents(events, "content_block_delta").filter(
        (e) => e.delta.type === "text_delta",
      );
      expect(deltas).toHaveLength(0);
    });
  });

  describe("response.reasoning_summary_text.delta event", () => {
    it("should open thinking block and emit thinking delta", () => {
      const event: ResponseReasoningSummaryTextDeltaEvent = {
        type: "response.reasoning_summary_text.delta",
        delta: "Let me think...",
        item_id: "item_123",
        output_index: 0,
        summary_index: 0,
        sequence_number: 1,
      };

      const events = translateResponsesStreamEvent(event, state);

      const blockStart = findEvent(events, "content_block_start");
      expect(blockStart).toBeDefined();
      expect(blockStart?.content_block.type).toBe("thinking");

      const delta = findEvent(events, "content_block_delta");
      expect(delta).toBeDefined();
      if (delta?.delta.type === "thinking_delta") {
        expect(delta.delta.thinking).toBe("Let me think...");
      }
    });

    it("should combine multiple summary_index into same block", () => {
      const event1: ResponseReasoningSummaryTextDeltaEvent = {
        type: "response.reasoning_summary_text.delta",
        delta: "First thought...",
        item_id: "item_123",
        output_index: 0,
        summary_index: 0,
        sequence_number: 1,
      };
      const event2: ResponseReasoningSummaryTextDeltaEvent = {
        type: "response.reasoning_summary_text.delta",
        delta: "Second thought...",
        item_id: "item_123",
        output_index: 0,
        summary_index: 1,
        sequence_number: 2,
      };

      translateResponsesStreamEvent(event1, state);
      const events = translateResponsesStreamEvent(event2, state);

      // Should not create new block
      const blockStarts = findEvents(events, "content_block_start");
      expect(blockStarts).toHaveLength(0);

      // Should have delta in same block (index 0)
      const delta = findEvent(events, "content_block_delta");
      expect(delta?.index).toBe(0);
    });
  });

  describe("response.reasoning_summary_text.done event", () => {
    it("should emit thinking delta if block has no prior delta", () => {
      const event: ResponseReasoningSummaryTextDoneEvent = {
        type: "response.reasoning_summary_text.done",
        text: "Complete thinking",
        item_id: "item_123",
        output_index: 0,
        summary_index: 0,
        sequence_number: 1,
      };

      const events = translateResponsesStreamEvent(event, state);

      const delta = findEvent(events, "content_block_delta");
      expect(delta).toBeDefined();
      if (delta?.delta.type === "thinking_delta") {
        expect(delta.delta.thinking).toBe("Complete thinking");
      }
    });

    it("should not emit delta if block already has delta", () => {
      // First send a delta
      const deltaEvent: ResponseReasoningSummaryTextDeltaEvent = {
        type: "response.reasoning_summary_text.delta",
        delta: "Partial thinking",
        item_id: "item_123",
        output_index: 0,
        summary_index: 0,
        sequence_number: 1,
      };
      translateResponsesStreamEvent(deltaEvent, state);

      // Then send done
      const doneEvent: ResponseReasoningSummaryTextDoneEvent = {
        type: "response.reasoning_summary_text.done",
        text: "Partial thinking complete",
        item_id: "item_123",
        output_index: 0,
        summary_index: 0,
        sequence_number: 2,
      };

      const events = translateResponsesStreamEvent(doneEvent, state);

      // Should not have additional thinking_delta
      const deltas = findEvents(events, "content_block_delta").filter(
        (e) => e.delta.type === "thinking_delta",
      );
      expect(deltas).toHaveLength(0);
    });
  });

  describe("response.output_item.done event", () => {
    it("should emit signature for reasoning item", () => {
      const event: ResponseOutputItemDoneEvent = {
        type: "response.output_item.done",
        item: {
          id: "reasoning_123",
          type: "reasoning",
          summary: [{ type: "summary_text", text: "Some thinking" }],
          encrypted_content: "encrypted_data",
        },
        output_index: 0,
        sequence_number: 1,
      };

      const events = translateResponsesStreamEvent(event, state);

      const signatureDeltas = findEvents(events, "content_block_delta").filter(
        (e) => e.delta.type === "signature_delta",
      );
      expect(signatureDeltas).toHaveLength(1);
      if (signatureDeltas[0]?.delta.type === "signature_delta") {
        expect(signatureDeltas[0].delta.signature).toBe(
          "encrypted_data@reasoning_123",
        );
      }
    });

    it("should emit default thinking text for reasoning item with empty summary", () => {
      const event: ResponseOutputItemDoneEvent = {
        type: "response.output_item.done",
        item: {
          id: "reasoning_123",
          type: "reasoning",
          summary: [],
          encrypted_content: "encrypted_data",
        },
        output_index: 0,
        sequence_number: 1,
      };

      const events = translateResponsesStreamEvent(event, state);

      const thinkingDeltas = findEvents(events, "content_block_delta").filter(
        (e) => e.delta.type === "thinking_delta",
      );
      expect(thinkingDeltas).toHaveLength(1);
      if (thinkingDeltas[0]?.delta.type === "thinking_delta") {
        expect(thinkingDeltas[0].delta.thinking).toBe("Thinking...");
      }
    });

    it("should handle compaction item with signature", () => {
      const event: ResponseOutputItemDoneEvent = {
        type: "response.output_item.done",
        item: {
          id: "compaction_123",
          type: "compaction",
          encrypted_content: "compacted_data",
        },
        output_index: 0,
        sequence_number: 1,
      };

      const events = translateResponsesStreamEvent(event, state);

      const signatureDeltas = findEvents(events, "content_block_delta").filter(
        (e) => e.delta.type === "signature_delta",
      );
      expect(signatureDeltas).toHaveLength(1);
      if (signatureDeltas[0]?.delta.type === "signature_delta") {
        expect(signatureDeltas[0].delta.signature).toBe(
          "cm1#compacted_data@compaction_123",
        );
      }
    });

    it("should not emit events for compaction without id", () => {
      const event: ResponseOutputItemDoneEvent = {
        type: "response.output_item.done",
        item: {
          id: "",
          type: "compaction",
          encrypted_content: "compacted_data",
        },
        output_index: 0,
        sequence_number: 1,
      };

      const events = translateResponsesStreamEvent(event, state);

      expect(events).toHaveLength(0);
    });
  });

  describe("response.function_call_arguments.delta event", () => {
    it("should emit input_json_delta for function call", () => {
      // First open a function call block
      const addEvent: ResponseOutputItemAddedEvent = {
        type: "response.output_item.added",
        item: {
          id: "call_123",
          type: "function_call",
          call_id: "tool_abc",
          name: "search",
          arguments: "",
        },
        output_index: 0,
        sequence_number: 1,
      };
      translateResponsesStreamEvent(addEvent, state);

      const deltaEvent: ResponseFunctionCallArgumentsDeltaEvent = {
        type: "response.function_call_arguments.delta",
        delta: '{"query": ',
        item_id: "call_123",
        output_index: 0,
        sequence_number: 2,
      };

      const events = translateResponsesStreamEvent(deltaEvent, state);

      const delta = findEvent(events, "content_block_delta");
      expect(delta).toBeDefined();
      if (delta?.delta.type === "input_json_delta") {
        expect(delta.delta.partial_json).toBe('{"query": ');
      }
    });

    it("should not emit events for empty delta", () => {
      // First open a function call block
      const addEvent: ResponseOutputItemAddedEvent = {
        type: "response.output_item.added",
        item: {
          id: "call_123",
          type: "function_call",
          call_id: "tool_abc",
          name: "search",
          arguments: "",
        },
        output_index: 0,
        sequence_number: 1,
      };
      translateResponsesStreamEvent(addEvent, state);

      const deltaEvent: ResponseFunctionCallArgumentsDeltaEvent = {
        type: "response.function_call_arguments.delta",
        delta: "",
        item_id: "call_123",
        output_index: 0,
        sequence_number: 2,
      };

      const events = translateResponsesStreamEvent(deltaEvent, state);

      expect(events).toHaveLength(0);
    });

    it("should emit error when excessive whitespace detected", () => {
      // First open a function call block
      const addEvent: ResponseOutputItemAddedEvent = {
        type: "response.output_item.added",
        item: {
          id: "call_123",
          type: "function_call",
          call_id: "tool_abc",
          name: "search",
          arguments: "",
        },
        output_index: 0,
        sequence_number: 1,
      };
      translateResponsesStreamEvent(addEvent, state);

      // Send delta with many consecutive newlines
      const deltaEvent: ResponseFunctionCallArgumentsDeltaEvent = {
        type: "response.function_call_arguments.delta",
        delta: "\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n", // 22 newlines
        item_id: "call_123",
        output_index: 0,
        sequence_number: 2,
      };

      const events = translateResponsesStreamEvent(deltaEvent, state);

      const errorEvent = findEvent(events, "error");
      expect(errorEvent).toBeDefined();
      expect(state.messageCompleted).toBe(true);
    });

    it("should create new function call block when delta received without prior added event", () => {
      // Send delta without first opening a function call block via output_item.added
      // The implementation creates a new block with default values
      const deltaEvent: ResponseFunctionCallArgumentsDeltaEvent = {
        type: "response.function_call_arguments.delta",
        delta: '{"query": "test"}',
        item_id: "call_123",
        output_index: 0,
        sequence_number: 1,
      };

      const events = translateResponsesStreamEvent(deltaEvent, state);

      // Should have created a new tool_use block with default name
      const blockStart = findEvent(events, "content_block_start");
      expect(blockStart).toBeDefined();
      expect(blockStart?.content_block.type).toBe("tool_use");
      if (blockStart?.content_block.type === "tool_use") {
        expect(blockStart.content_block.name).toBe("function"); // default name
        expect(blockStart.content_block.id).toBe("tool_call_0"); // default id
      }

      // Should also emit the delta
      const delta = findEvent(events, "content_block_delta");
      expect(delta).toBeDefined();
      if (delta?.delta.type === "input_json_delta") {
        expect(delta.delta.partial_json).toBe('{"query": "test"}');
      }
    });
  });

  describe("response.function_call_arguments.done event", () => {
    it("should emit final arguments if no delta was sent", () => {
      // First open a function call block
      const addEvent: ResponseOutputItemAddedEvent = {
        type: "response.output_item.added",
        item: {
          id: "call_123",
          type: "function_call",
          call_id: "tool_abc",
          name: "search",
          arguments: "",
        },
        output_index: 0,
        sequence_number: 1,
      };
      translateResponsesStreamEvent(addEvent, state);

      const doneEvent: ResponseFunctionCallArgumentsDoneEvent = {
        type: "response.function_call_arguments.done",
        arguments: '{"query": "test"}',
        item_id: "call_123",
        name: "search",
        output_index: 0,
        sequence_number: 2,
      };

      const events = translateResponsesStreamEvent(doneEvent, state);

      const delta = findEvent(events, "content_block_delta");
      expect(delta).toBeDefined();
      if (delta?.delta.type === "input_json_delta") {
        expect(delta.delta.partial_json).toBe('{"query": "test"}');
      }
    });

    it("should clean up function call state", () => {
      // First open a function call block
      const addEvent: ResponseOutputItemAddedEvent = {
        type: "response.output_item.added",
        item: {
          id: "call_123",
          type: "function_call",
          call_id: "tool_abc",
          name: "search",
          arguments: "",
        },
        output_index: 0,
        sequence_number: 1,
      };
      translateResponsesStreamEvent(addEvent, state);

      expect(state.functionCallStateByOutputIndex.has(0)).toBe(true);

      const doneEvent: ResponseFunctionCallArgumentsDoneEvent = {
        type: "response.function_call_arguments.done",
        arguments: '{"query": "test"}',
        item_id: "call_123",
        name: "search",
        output_index: 0,
        sequence_number: 2,
      };

      translateResponsesStreamEvent(doneEvent, state);

      expect(state.functionCallStateByOutputIndex.has(0)).toBe(false);
    });
  });

  describe("response.completed event", () => {
    it("should close all open blocks and emit message_delta and message_stop", () => {
      // First open a text block
      const textEvent: ResponseTextDeltaEvent = {
        type: "response.output_text.delta",
        delta: "Hello",
        item_id: "item_123",
        output_index: 0,
        content_index: 0,
        sequence_number: 1,
      };
      translateResponsesStreamEvent(textEvent, state);

      expect(state.openBlocks.size).toBe(1);

      const completedEvent: ResponseCompletedEvent = {
        type: "response.completed",
        response: createBaseResponse({
          status: "completed",
          output: [
            {
              id: "msg_123",
              type: "message",
              role: "assistant",
              status: "completed",
              content: [
                { type: "output_text", text: "Hello", annotations: [] },
              ],
            },
          ],
        }),
        sequence_number: 2,
      };

      const events = translateResponsesStreamEvent(completedEvent, state);

      expect(findEvent(events, "content_block_stop")).toBeDefined();
      expect(findEvent(events, "message_delta")).toBeDefined();
      expect(findEvent(events, "message_stop")).toBeDefined();
      expect(state.messageCompleted).toBe(true);
      expect(state.openBlocks.size).toBe(0);
    });

    it("should emit tool_use stop_reason when function_call output exists", () => {
      const completedEvent: ResponseCompletedEvent = {
        type: "response.completed",
        response: createBaseResponse({
          status: "completed",
          output: [
            {
              id: "call_123",
              type: "function_call",
              call_id: "tool_abc",
              name: "search",
              arguments: '{"query": "test"}',
              status: "completed",
            },
          ],
        }),
        sequence_number: 1,
      };

      const events = translateResponsesStreamEvent(completedEvent, state);

      const messageDelta = findEvent(events, "message_delta");
      expect(messageDelta?.delta.stop_reason).toBe("tool_use");
    });
  });

  describe("response.incomplete event", () => {
    it("should handle incomplete with max_output_tokens reason", () => {
      const incompleteEvent: ResponseIncompleteEvent = {
        type: "response.incomplete",
        response: createBaseResponse({
          status: "incomplete",
          incomplete_details: { reason: "max_output_tokens" },
        }),
        sequence_number: 1,
      };

      const events = translateResponsesStreamEvent(incompleteEvent, state);

      const messageDelta = findEvent(events, "message_delta");
      expect(messageDelta?.delta.stop_reason).toBe("max_tokens");
      expect(state.messageCompleted).toBe(true);
    });

    it("should handle incomplete with content_filter reason", () => {
      const incompleteEvent: ResponseIncompleteEvent = {
        type: "response.incomplete",
        response: createBaseResponse({
          status: "incomplete",
          incomplete_details: { reason: "content_filter" },
        }),
        sequence_number: 1,
      };

      const events = translateResponsesStreamEvent(incompleteEvent, state);

      const messageDelta = findEvent(events, "message_delta");
      expect(messageDelta?.delta.stop_reason).toBe("end_turn");
    });
  });

  describe("response.failed event", () => {
    it("should emit error event with response error message", () => {
      const failedEvent: ResponseFailedEvent = {
        type: "response.failed",
        response: createBaseResponse({
          status: "failed",
          error: { message: "Model overloaded" },
        }),
        sequence_number: 1,
      };

      const events = translateResponsesStreamEvent(failedEvent, state);

      const errorEvent = findEvent(events, "error");
      expect(errorEvent).toBeDefined();
      expect(errorEvent?.error.message).toBe("Model overloaded");
      expect(state.messageCompleted).toBe(true);
    });

    it("should use default message when error is missing", () => {
      const failedEvent: ResponseFailedEvent = {
        type: "response.failed",
        response: createBaseResponse({
          status: "failed",
          error: null,
        }),
        sequence_number: 1,
      };

      const events = translateResponsesStreamEvent(failedEvent, state);

      const errorEvent = findEvent(events, "error");
      expect(errorEvent?.error.message).toBe(
        "The response failed due to an unknown error.",
      );
    });
  });

  describe("error event", () => {
    it("should emit error event with message", () => {
      const errorEvent: ResponseErrorEvent = {
        type: "error",
        message: "Connection lost",
        code: "connection_error",
        param: null,
        sequence_number: 1,
      };

      const events = translateResponsesStreamEvent(errorEvent, state);

      const error = findEvent(events, "error");
      expect(error).toBeDefined();
      expect(error?.error.message).toBe("Connection lost");
      expect(state.messageCompleted).toBe(true);
    });

    it("should use default message when message is not a string", () => {
      const errorEvent: ResponseErrorEvent = {
        type: "error",
        message: null as unknown as string,
        code: "unknown",
        param: null,
        sequence_number: 1,
      };

      const events = translateResponsesStreamEvent(errorEvent, state);

      const error = findEvent(events, "error");
      expect(error?.error.message).toBe(
        "An unexpected error occurred during streaming.",
      );
    });
  });

  describe("unrecognized event types", () => {
    it("should return empty array for unknown event types", () => {
      const unknownEvent = {
        type: "unknown.event.type",
        data: "some data",
      } as unknown as ResponseStreamEvent;

      const events = translateResponsesStreamEvent(unknownEvent, state);

      expect(events).toHaveLength(0);
    });
  });

  describe("block management", () => {
    it("should close previous blocks when opening new block type", () => {
      // Open thinking block
      const thinkingEvent: ResponseReasoningSummaryTextDeltaEvent = {
        type: "response.reasoning_summary_text.delta",
        delta: "Thinking...",
        item_id: "item_123",
        output_index: 0,
        summary_index: 0,
        sequence_number: 1,
      };
      translateResponsesStreamEvent(thinkingEvent, state);

      expect(state.openBlocks.size).toBe(1);

      // Open text block - should close thinking
      const textEvent: ResponseTextDeltaEvent = {
        type: "response.output_text.delta",
        delta: "Result",
        item_id: "item_456",
        output_index: 1,
        content_index: 0,
        sequence_number: 2,
      };

      const events = translateResponsesStreamEvent(textEvent, state);

      const blockStop = findEvent(events, "content_block_stop");
      expect(blockStop).toBeDefined();
      expect(blockStop?.index).toBe(0); // thinking block index

      const blockStart = findEvent(events, "content_block_start");
      expect(blockStart?.content_block.type).toBe("text");
    });

    it("should maintain separate blocks for different output_index", () => {
      const event1: ResponseTextDeltaEvent = {
        type: "response.output_text.delta",
        delta: "First",
        item_id: "item_1",
        output_index: 0,
        content_index: 0,
        sequence_number: 1,
      };

      const event2: ResponseTextDeltaEvent = {
        type: "response.output_text.delta",
        delta: "Second",
        item_id: "item_2",
        output_index: 1,
        content_index: 0,
        sequence_number: 2,
      };

      translateResponsesStreamEvent(event1, state);
      translateResponsesStreamEvent(event2, state);

      expect(state.nextContentBlockIndex).toBe(2);
      expect(state.blockIndexByKey.size).toBe(2);
    });
  });
});

describe("Integration: Complete stream flow", () => {
  let state: ResponsesStreamState;

  beforeEach(() => {
    state = createResponsesStreamState();
  });

  it("should handle full conversation flow with thinking and text", () => {
    const allEvents: Array<AnthropicStreamEventData> = [];

    // 1. Response created
    const createdEvent: ResponseCreatedEvent = {
      type: "response.created",
      response: createBaseResponse(),
      sequence_number: 0,
    };
    allEvents.push(...translateResponsesStreamEvent(createdEvent, state));

    expect(state.messageStartSent).toBe(true);

    // 2. Reasoning summary text
    const thinkingEvent: ResponseReasoningSummaryTextDeltaEvent = {
      type: "response.reasoning_summary_text.delta",
      delta: "Analyzing the question...",
      item_id: "reasoning_1",
      output_index: 0,
      summary_index: 0,
      sequence_number: 1,
    };
    allEvents.push(...translateResponsesStreamEvent(thinkingEvent, state));

    // 3. Output text
    const textEvent: ResponseTextDeltaEvent = {
      type: "response.output_text.delta",
      delta: "The answer is 42.",
      item_id: "msg_1",
      output_index: 1,
      content_index: 0,
      sequence_number: 2,
    };
    allEvents.push(...translateResponsesStreamEvent(textEvent, state));

    // 4. Response completed
    const completedEvent: ResponseCompletedEvent = {
      type: "response.completed",
      response: createBaseResponse({
        output: [
          {
            id: "reasoning_1",
            type: "reasoning",
            summary: [
              { type: "summary_text", text: "Analyzing the question..." },
            ],
            encrypted_content: "enc_data",
          },
          {
            id: "msg_1",
            type: "message",
            role: "assistant",
            status: "completed",
            content: [
              {
                type: "output_text",
                text: "The answer is 42.",
                annotations: [],
              },
            ],
          },
        ],
      }),
      sequence_number: 3,
    };
    allEvents.push(...translateResponsesStreamEvent(completedEvent, state));

    // Verify final state
    expect(state.messageCompleted).toBe(true);
    expect(state.openBlocks.size).toBe(0);

    // Verify event counts
    expect(findEvents(allEvents, "message_start")).toHaveLength(1);
    expect(findEvents(allEvents, "content_block_start")).toHaveLength(2); // thinking + text
    expect(findEvents(allEvents, "content_block_stop")).toHaveLength(2);
    expect(findEvents(allEvents, "message_stop")).toHaveLength(1);
  });

  it("should handle function call flow", () => {
    const allEvents: Array<AnthropicStreamEventData> = [];

    // 1. Response created
    const createdEvent: ResponseCreatedEvent = {
      type: "response.created",
      response: createBaseResponse(),
      sequence_number: 0,
    };
    allEvents.push(...translateResponsesStreamEvent(createdEvent, state));

    // 2. Function call added
    const funcAddEvent: ResponseOutputItemAddedEvent = {
      type: "response.output_item.added",
      item: {
        id: "call_1",
        type: "function_call",
        call_id: "tool_123",
        name: "get_weather",
        arguments: "",
      },
      output_index: 0,
      sequence_number: 1,
    };
    allEvents.push(...translateResponsesStreamEvent(funcAddEvent, state));

    // 3. Function call arguments delta
    const argsDelta: ResponseFunctionCallArgumentsDeltaEvent = {
      type: "response.function_call_arguments.delta",
      delta: '{"city": "Tokyo"}',
      item_id: "call_1",
      output_index: 0,
      sequence_number: 2,
    };
    allEvents.push(...translateResponsesStreamEvent(argsDelta, state));

    // 4. Function call arguments done
    const argsDone: ResponseFunctionCallArgumentsDoneEvent = {
      type: "response.function_call_arguments.done",
      arguments: '{"city": "Tokyo"}',
      item_id: "call_1",
      name: "get_weather",
      output_index: 0,
      sequence_number: 3,
    };
    allEvents.push(...translateResponsesStreamEvent(argsDone, state));

    // 5. Response completed with function call
    const completedEvent: ResponseCompletedEvent = {
      type: "response.completed",
      response: createBaseResponse({
        output: [
          {
            id: "call_1",
            type: "function_call",
            call_id: "tool_123",
            name: "get_weather",
            arguments: '{"city": "Tokyo"}',
            status: "completed",
          },
        ],
      }),
      sequence_number: 4,
    };
    allEvents.push(...translateResponsesStreamEvent(completedEvent, state));

    // Verify tool_use block
    const blockStarts = findEvents(allEvents, "content_block_start");
    expect(blockStarts).toHaveLength(1);
    expect(blockStarts[0]?.content_block.type).toBe("tool_use");

    // Verify stop reason
    const messageDelta = findEvent(allEvents, "message_delta");
    expect(messageDelta?.delta.stop_reason).toBe("tool_use");
  });
});
