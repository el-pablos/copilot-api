import { beforeEach, describe, expect, it, mock } from "bun:test";

import type { AnthropicMessagesPayload } from "~/routes/messages/anthropic-types";

const copilotHeadersMock = mock(
  (_state: unknown, options?: { token?: string }) => ({
    Authorization: `Bearer ${options?.token ?? "fallback-token"}`,
  }),
);
const copilotBaseUrlMock = mock(() => "https://api.githubcopilot.com");
const prepareForCompactMock = mock(() => {});
const prepareInteractionHeadersMock = mock(() => {});

const getConfigMock = mock(() => ({ requestTimeoutMs: 30_000 }));
const getBestFallbackMock = mock(() => null);
const sleepMock = mock(async () => {});

const isPoolEnabledSyncMock = mock(() => false);
const getCurrentAccountMock = mock(() => null);
const reportAccountErrorMock = mock(() => {});

const getActiveCopilotTokenMock = mock(async () => "pooled-token");
const fetchWithTimeoutMock = mock(
  async () =>
    new Response(
      JSON.stringify({
        id: "msg_123",
        type: "message",
        role: "assistant",
        model: "claude-sonnet-4.5",
        content: [{ type: "text", text: "ok" }],
        stop_reason: "end_turn",
        stop_sequence: null,
        usage: {
          input_tokens: 10,
          output_tokens: 5,
        },
      }),
      {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      },
    ),
);

mock.module("~/lib/api-config", () => ({
  copilotHeaders: copilotHeadersMock,
  copilotBaseUrl: copilotBaseUrlMock,
  prepareForCompact: prepareForCompactMock,
  prepareInteractionHeaders: prepareInteractionHeadersMock,
}));

mock.module("~/lib/config", () => ({
  getConfig: getConfigMock,
}));

mock.module("~/lib/fallback", () => ({
  getBestFallback: getBestFallbackMock,
}));

mock.module("~/lib/retry", () => ({
  sleep: sleepMock,
}));

mock.module("~/lib/account-pool", () => ({
  isPoolEnabledSync: isPoolEnabledSyncMock,
  getCurrentAccount: getCurrentAccountMock,
  reportAccountError: reportAccountErrorMock,
}));

mock.module("~/lib/token", () => ({
  getActiveCopilotToken: getActiveCopilotTokenMock,
}));

mock.module("~/lib/fetch-with-timeout", () => ({
  fetchWithTimeout: fetchWithTimeoutMock,
}));

mock.module("~/lib/state", () => ({
  state: {
    copilotToken: "fallback-token",
    accountType: "individual",
    vsCodeVersion: "1.99.0",
  },
}));

import { createMessages } from "~/services/copilot/create-messages";

function basePayload(): AnthropicMessagesPayload {
  return {
    model: "claude-sonnet-4.5",
    max_tokens: 1024,
    messages: [{ role: "user", content: "Halo" }],
  };
}

describe("createMessages session affinity", () => {
  beforeEach(() => {
    copilotHeadersMock.mockClear();
    copilotBaseUrlMock.mockClear();
    prepareForCompactMock.mockClear();
    prepareInteractionHeadersMock.mockClear();
    getConfigMock.mockClear();
    getBestFallbackMock.mockClear();
    sleepMock.mockClear();
    isPoolEnabledSyncMock.mockClear();
    getCurrentAccountMock.mockClear();
    reportAccountErrorMock.mockClear();
    getActiveCopilotTokenMock.mockReset();
    getActiveCopilotTokenMock.mockResolvedValue("pooled-token");
    fetchWithTimeoutMock.mockClear();
  });

  it("should reuse the same pooled token for the same sessionId", async () => {
    getActiveCopilotTokenMock
      .mockResolvedValueOnce("pooled-token-1")
      .mockResolvedValueOnce("pooled-token-2");

    await createMessages(basePayload(), undefined, {
      requestId: "req_1",
      sessionId: "sess_sticky",
    });

    await createMessages(basePayload(), undefined, {
      requestId: "req_2",
      sessionId: "sess_sticky",
    });

    const firstCallHeaderOptions = copilotHeadersMock.mock.calls[0]?.[1] as
      | { token?: string }
      | undefined;
    const secondCallHeaderOptions = copilotHeadersMock.mock.calls[1]?.[1] as
      | { token?: string }
      | undefined;

    expect(firstCallHeaderOptions?.token).toBe("pooled-token-1");
    expect(secondCallHeaderOptions?.token).toBe("pooled-token-1");
    expect(getActiveCopilotTokenMock).toHaveBeenCalledTimes(1);
  });

  it("should reuse token with subagent session marker when sessionId is missing", async () => {
    getActiveCopilotTokenMock
      .mockResolvedValueOnce("pooled-token-1")
      .mockResolvedValueOnce("pooled-token-2");

    await createMessages(basePayload(), undefined, {
      requestId: "req_sub_1",
      subagentMarker: {
        session_id: "subagent-session-abc",
        agent_id: "agent-1",
        agent_type: "general-purpose",
      },
    });

    await createMessages(basePayload(), undefined, {
      requestId: "req_sub_2",
      subagentMarker: {
        session_id: "subagent-session-abc",
        agent_id: "agent-1",
        agent_type: "general-purpose",
      },
    });

    const firstCallHeaderOptions = copilotHeadersMock.mock.calls[0]?.[1] as
      | { token?: string }
      | undefined;
    const secondCallHeaderOptions = copilotHeadersMock.mock.calls[1]?.[1] as
      | { token?: string }
      | undefined;

    expect(firstCallHeaderOptions?.token).toBe("pooled-token-1");
    expect(secondCallHeaderOptions?.token).toBe("pooled-token-1");
    expect(getActiveCopilotTokenMock).toHaveBeenCalledTimes(1);
  });

  it("should rebootstrap once by stripping thinking blocks on connection mismatch 401", async () => {
    getActiveCopilotTokenMock
      .mockResolvedValueOnce("pooled-token-1")
      .mockResolvedValueOnce("pooled-token-1");

    fetchWithTimeoutMock.mockImplementation(async (_url, init) => {
      const rawBody = String(init?.body ?? "{}");
      const parsedBody = JSON.parse(rawBody) as AnthropicMessagesPayload;

      const hasThinkingBlock = parsedBody.messages.some(
        (message) =>
          Array.isArray(message.content) &&
          message.content.some((block) => block.type === "thinking"),
      );

      if (hasThinkingBlock) {
        return new Response(
          JSON.stringify({
            error: {
              message: "input item ID does not belong to this connection",
            },
          }),
          {
            status: 401,
            headers: {
              "content-type": "application/json",
            },
          },
        );
      }

      return new Response(
        JSON.stringify({
          id: "msg_rebootstrap_ok",
          type: "message",
          role: "assistant",
          model: "claude-sonnet-4.5",
          content: [{ type: "text", text: "rebootstrap-ok" }],
          stop_reason: "end_turn",
          stop_sequence: null,
          usage: {
            input_tokens: 22,
            output_tokens: 11,
          },
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      );
    });

    const payloadWithThinking: AnthropicMessagesPayload = {
      model: "claude-sonnet-4.5",
      max_tokens: 1024,
      messages: [
        {
          role: "assistant",
          content: [
            {
              type: "thinking",
              thinking: "thinking state",
              signature: "sig_123",
            },
          ],
        },
        { role: "user", content: "lanjut" },
      ],
    };

    const result = await createMessages(payloadWithThinking, undefined, {
      requestId: "req_rebootstrap",
      sessionId: "sess_rebootstrap",
    });

    expect(result).toMatchObject({
      id: "msg_rebootstrap_ok",
      type: "message",
    });

    expect(fetchWithTimeoutMock).toHaveBeenCalledTimes(2);

    const firstBody = JSON.parse(
      String(fetchWithTimeoutMock.mock.calls[0]?.[1]?.body ?? "{}"),
    ) as AnthropicMessagesPayload;
    const secondBody = JSON.parse(
      String(fetchWithTimeoutMock.mock.calls[1]?.[1]?.body ?? "{}"),
    ) as AnthropicMessagesPayload;

    expect(JSON.stringify(firstBody)).toContain('"type":"thinking"');
    expect(JSON.stringify(secondBody)).not.toContain('"type":"thinking"');
    expect(sleepMock).not.toHaveBeenCalled();
  });

  it("should perform one rebootstrap retry even when mismatch happens on the last retry attempt", async () => {
    getActiveCopilotTokenMock.mockResolvedValue("pooled-token-1");

    let callCount = 0;
    fetchWithTimeoutMock.mockImplementation(async (_url, init) => {
      callCount += 1;

      if (callCount <= 2) {
        return new Response(
          JSON.stringify({
            error: {
              message: "Bad request",
            },
          }),
          {
            status: 400,
            headers: {
              "content-type": "application/json",
            },
          },
        );
      }

      const rawBody = String(init?.body ?? "{}");
      const parsedBody = JSON.parse(rawBody) as AnthropicMessagesPayload;
      const hasThinkingBlock = parsedBody.messages.some(
        (message) =>
          Array.isArray(message.content) &&
          message.content.some((block) => block.type === "thinking"),
      );

      if (callCount === 3) {
        expect(hasThinkingBlock).toBe(true);

        return new Response(
          JSON.stringify({
            error: {
              message: "input item ID does not belong to this connection",
            },
          }),
          {
            status: 401,
            headers: {
              "content-type": "application/json",
            },
          },
        );
      }

      expect(hasThinkingBlock).toBe(false);

      return new Response(
        JSON.stringify({
          id: "msg_rebootstrap_last_attempt_ok",
          type: "message",
          role: "assistant",
          model: "claude-sonnet-4.5",
          content: [{ type: "text", text: "rebootstrap-last-attempt-ok" }],
          stop_reason: "end_turn",
          stop_sequence: null,
          usage: {
            input_tokens: 24,
            output_tokens: 12,
          },
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      );
    });

    const payloadWithThinking: AnthropicMessagesPayload = {
      model: "claude-sonnet-4.5",
      max_tokens: 1024,
      messages: [
        {
          role: "assistant",
          content: [
            {
              type: "thinking",
              thinking: "thinking state",
              signature: "sig_last_attempt",
            },
          ],
        },
        { role: "user", content: "lanjut" },
      ],
    };

    const result = await createMessages(payloadWithThinking, undefined, {
      requestId: "req_rebootstrap_last_attempt",
      sessionId: "sess_rebootstrap_last_attempt",
    });

    expect(result).toMatchObject({
      id: "msg_rebootstrap_last_attempt_ok",
      type: "message",
    });

    expect(fetchWithTimeoutMock).toHaveBeenCalledTimes(4);
  });

  it("should stop after one rebootstrap retry when mismatch persists", async () => {
    getActiveCopilotTokenMock.mockResolvedValue("pooled-token-1");

    fetchWithTimeoutMock.mockImplementation(async () => {
      return new Response(
        JSON.stringify({
          error: {
            message: "input item ID does not belong to this connection",
          },
        }),
        {
          status: 401,
          headers: {
            "content-type": "application/json",
          },
        },
      );
    });

    const payloadWithThinking: AnthropicMessagesPayload = {
      model: "claude-sonnet-4.5",
      max_tokens: 1024,
      messages: [
        {
          role: "assistant",
          content: [
            {
              type: "thinking",
              thinking: "thinking state",
              signature: "sig_persistent",
            },
          ],
        },
        { role: "user", content: "lanjut" },
      ],
    };

    await expect(
      createMessages(payloadWithThinking, undefined, {
        requestId: "req_rebootstrap_persistent",
        sessionId: "sess_rebootstrap_persistent",
      }),
    ).rejects.toThrow("Failed to create messages");

    expect(fetchWithTimeoutMock).toHaveBeenCalledTimes(2);
    expect(sleepMock).not.toHaveBeenCalled();
  });
});
