import type { Context } from "hono";

import { describe, expect, it } from "bun:test";

import { getUUID } from "~/lib/utils";

import type { AnthropicMessagesPayload } from "../anthropic-types";
import { getRootSessionId } from "../subagent-marker";

function createContext(headers: Record<string, string | undefined>): Context {
  return {
    req: {
      header: (name: string) => headers[name],
    },
  } as unknown as Context;
}

describe("getRootSessionId", () => {
  it("should parse session_id from metadata.user_id JSON", () => {
    const payload: AnthropicMessagesPayload = {
      model: "claude-sonnet-4.5",
      max_tokens: 1024,
      messages: [{ role: "user", content: "hello" }],
      metadata: {
        user_id:
          '{"session_id":"session-json-123","safety_identifier":"safe-1"}',
      },
    };

    const context = createContext({});

    const result = getRootSessionId(payload, context);

    expect(result).toBe(getUUID("session-json-123"));
  });

  it("should fallback to x-session-id header when metadata is missing", () => {
    const payload: AnthropicMessagesPayload = {
      model: "claude-sonnet-4.5",
      max_tokens: 1024,
      messages: [{ role: "user", content: "hello" }],
    };

    const context = createContext({ "x-session-id": "header-session-999" });

    const result = getRootSessionId(payload, context);

    expect(result).toBe(getUUID("header-session-999"));
  });
});
