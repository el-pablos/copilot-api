import { beforeEach, describe, expect, it, mock } from "bun:test";

const copilotHeadersMock = mock(() => ({
  Authorization: "Bearer pooled-token",
}));
const copilotBaseUrlMock = mock(() => "https://api.githubcopilot.com");

const fetchWithTimeoutMock = mock(async () => {
  return new Response(
    JSON.stringify({
      id: "resp_123",
      object: "response",
      created_at: 0,
      model: "gpt-5.3-codex",
      output: [],
      output_text: "",
      status: "completed",
      usage: null,
      error: null,
      incomplete_details: null,
      instructions: null,
      metadata: null,
      parallel_tool_calls: true,
      temperature: null,
      tool_choice: "auto",
      tools: [],
      top_p: null,
    }),
    {
      status: 200,
      headers: {
        "content-type": "application/json",
      },
    },
  );
});

const getActiveCopilotTokenMock = mock(async () => "pooled-token");
const getConfigMock = mock(() => ({ requestTimeoutMs: 30_000 }));

mock.module("~/lib/api-config", () => ({
  copilotHeaders: copilotHeadersMock,
  copilotBaseUrl: copilotBaseUrlMock,
}));

mock.module("~/lib/fetch-with-timeout", () => ({
  fetchWithTimeout: fetchWithTimeoutMock,
}));

mock.module("~/lib/token", () => ({
  getActiveCopilotToken: getActiveCopilotTokenMock,
}));

mock.module("~/lib/config", () => ({
  getConfig: getConfigMock,
}));

mock.module("~/lib/state", () => ({
  state: {
    copilotToken: "fallback-token",
    accountType: "individual",
    vsCodeVersion: "1.99.0",
  },
}));

import { createResponses } from "~/services/copilot/create-responses";

describe("createResponses", () => {
  beforeEach(() => {
    copilotHeadersMock.mockClear();
    copilotBaseUrlMock.mockClear();
    fetchWithTimeoutMock.mockClear();
    getActiveCopilotTokenMock.mockClear();
    getConfigMock.mockClear();
  });

  it("should forward request/session/subagent context into copilot headers", async () => {
    await createResponses(
      {
        model: "gpt-5.3-codex",
        input: [],
        stream: false,
      },
      {
        vision: false,
        initiator: "agent",
        requestId: "req_abc",
        sessionId: "sess_xyz",
        subagentMarker: { session_id: "sub_session" },
        isCompact: true,
      },
    );

    expect(copilotHeadersMock).toHaveBeenCalledTimes(1);

    const [, headerOptions] = copilotHeadersMock.mock.calls[0] as [
      unknown,
      Record<string, unknown>,
    ];

    expect(headerOptions).toMatchObject({
      vision: false,
      token: "pooled-token",
      requestId: "req_abc",
      sessionId: "sess_xyz",
      isSubagent: true,
    });
  });

  it("should reuse the same pooled token for the same sessionId", async () => {
    getActiveCopilotTokenMock
      .mockResolvedValueOnce("pooled-token-1")
      .mockResolvedValueOnce("pooled-token-2");

    await createResponses(
      {
        model: "gpt-5.3-codex",
        input: [],
        stream: false,
      },
      {
        vision: false,
        initiator: "agent",
        requestId: "req_1",
        sessionId: "sess_sticky",
      },
    );

    await createResponses(
      {
        model: "gpt-5.3-codex",
        input: [],
        stream: false,
      },
      {
        vision: false,
        initiator: "agent",
        requestId: "req_2",
        sessionId: "sess_sticky",
      },
    );

    const firstCallHeaderOptions = copilotHeadersMock.mock.calls[0]?.[1] as
      | Record<string, unknown>
      | undefined;
    const secondCallHeaderOptions = copilotHeadersMock.mock.calls[1]?.[1] as
      | Record<string, unknown>
      | undefined;

    expect(firstCallHeaderOptions?.token).toBe("pooled-token-1");
    expect(secondCallHeaderOptions?.token).toBe("pooled-token-1");
    expect(getActiveCopilotTokenMock).toHaveBeenCalledTimes(1);
  });

  it("should rebootstrap once by stripping connection-bound input on mismatch 401", async () => {
    getActiveCopilotTokenMock
      .mockResolvedValueOnce("pooled-token-1")
      .mockResolvedValueOnce("pooled-token-2");

    fetchWithTimeoutMock.mockImplementation(async (_url, init) => {
      const parsedBody = JSON.parse(String(init?.body ?? "{}")) as Record<
        string,
        unknown
      >;
      const parsedInput = parsedBody.input;

      const hasConnectionBoundInput =
        Array.isArray(parsedInput) &&
        parsedInput.some((item) => {
          if (!item || typeof item !== "object") return false;
          const type = (item as { type?: string }).type;
          return type === "reasoning" || type === "compaction";
        });

      if (hasConnectionBoundInput) {
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
          id: "resp_rebootstrap_ok",
          object: "response",
          created_at: 0,
          model: "gpt-5.3-codex",
          output: [],
          output_text: "ok",
          status: "completed",
          usage: null,
          error: null,
          incomplete_details: null,
          instructions: null,
          metadata: null,
          parallel_tool_calls: true,
          temperature: null,
          tool_choice: "auto",
          tools: [],
          top_p: null,
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      );
    });

    const result = await createResponses(
      {
        model: "gpt-5.3-codex",
        input: [
          {
            type: "message",
            role: "user",
            content: [{ type: "input_text", text: "halo" }],
          },
          {
            type: "reasoning",
            id: "rs_1",
            summary: [{ type: "summary_text", text: "Thinking..." }],
            encrypted_content: "enc_reasoning_1",
          },
          {
            type: "compaction",
            id: "cmp_1",
            encrypted_content: "enc_compaction_1",
          },
        ],
        stream: false,
      },
      {
        vision: false,
        initiator: "agent",
        requestId: "req_rebootstrap_1",
        sessionId: "sess_rebootstrap",
      },
    );

    expect(result).toMatchObject({
      id: "resp_rebootstrap_ok",
      object: "response",
    });

    expect(fetchWithTimeoutMock).toHaveBeenCalledTimes(2);

    const firstBody = JSON.parse(
      String(fetchWithTimeoutMock.mock.calls[0]?.[1]?.body ?? "{}"),
    ) as { input?: Array<{ type?: string }> };
    const secondBody = JSON.parse(
      String(fetchWithTimeoutMock.mock.calls[1]?.[1]?.body ?? "{}"),
    ) as { input?: Array<{ type?: string }> };

    expect(firstBody.input?.some((item) => item.type === "reasoning")).toBe(
      true,
    );
    expect(firstBody.input?.some((item) => item.type === "compaction")).toBe(
      true,
    );

    expect(secondBody.input?.some((item) => item.type === "reasoning")).toBe(
      false,
    );
    expect(secondBody.input?.some((item) => item.type === "compaction")).toBe(
      false,
    );

    const firstHeaderOptions = copilotHeadersMock.mock.calls[0]?.[1] as
      | Record<string, unknown>
      | undefined;
    const secondHeaderOptions = copilotHeadersMock.mock.calls[1]?.[1] as
      | Record<string, unknown>
      | undefined;

    expect(firstHeaderOptions?.token).toBe("pooled-token-1");
    expect(secondHeaderOptions?.token).toBe("pooled-token-2");
    expect(getActiveCopilotTokenMock).toHaveBeenCalledTimes(2);
  });

  it("should stop after one rebootstrap retry when mismatch persists", async () => {
    getActiveCopilotTokenMock
      .mockResolvedValueOnce("pooled-token-1")
      .mockResolvedValueOnce("pooled-token-2");

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

    await expect(
      createResponses(
        {
          model: "gpt-5.3-codex",
          input: [
            {
              type: "message",
              role: "user",
              content: [{ type: "input_text", text: "lanjut" }],
            },
            {
              type: "reasoning",
              id: "rs_2",
              summary: [{ type: "summary_text", text: "Thinking..." }],
              encrypted_content: "enc_reasoning_2",
            },
          ],
          stream: false,
        },
        {
          vision: false,
          initiator: "agent",
          requestId: "req_rebootstrap_persist",
          sessionId: "sess_rebootstrap_persist",
        },
      ),
    ).rejects.toThrow("Failed to create responses");

    expect(fetchWithTimeoutMock).toHaveBeenCalledTimes(2);
    expect(getActiveCopilotTokenMock).toHaveBeenCalledTimes(2);
  });
});
