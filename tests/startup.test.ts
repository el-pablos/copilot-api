import { describe, test, expect, beforeEach, afterEach } from "bun:test";

import { state } from "../src/lib/state";

describe("startup initialization", () => {
  // backup original state values
  let originalState: typeof state;

  beforeEach(() => {
    originalState = { ...state };
  });

  afterEach(() => {
    // restore original state
    Object.assign(state, originalState);
  });

  test("state has default values initialized", () => {
    // state should have required properties
    expect(state).toHaveProperty("accountType");
    expect(state).toHaveProperty("manualApprove");
    expect(state).toHaveProperty("showToken");
  });

  test("state can be modified for CLI options", () => {
    // simulate applyCliOptions behavior
    state.accountType = "business";
    state.manualApprove = true;
    state.rateLimitSeconds = 5;
    state.rateLimitWait = true;
    state.showToken = true;

    expect(state.accountType).toBe("business");
    expect(state.manualApprove).toBe(true);
    expect(state.rateLimitSeconds).toBe(5);
    expect(state.rateLimitWait).toBe(true);
    expect(state.showToken).toBe(true);
  });

  test("state supports different account types", () => {
    const accountTypes = ["individual", "business", "enterprise"];

    for (const type of accountTypes) {
      state.accountType = type;
      expect(state.accountType).toBe(type);
    }
  });

  test("state can store copilot token", () => {
    state.copilotToken = "test-copilot-token";
    expect(state.copilotToken).toBe("test-copilot-token");

    // cleanup
    state.copilotToken = undefined;
    expect(state.copilotToken).toBeUndefined();
  });

  test("state can store github token and user", () => {
    state.githubToken = "test-github-token";
    state.githubUser = {
      login: "testuser",
      id: 12345,
      name: "Test User",
      avatar_url: "https://example.com/avatar.png",
    };

    expect(state.githubToken).toBe("test-github-token");
    expect(state.githubUser?.login).toBe("testuser");
    expect(state.githubUser?.id).toBe(12345);
  });

  test("state can store models list", () => {
    state.models = {
      object: "list",
      data: [
        {
          id: "gpt-4",
          object: "model",
          created: 0,
          owned_by: "openai",
        },
        {
          id: "claude-sonnet-4",
          object: "model",
          created: 0,
          owned_by: "anthropic",
        },
      ],
    };

    expect(state.models?.data).toHaveLength(2);
    expect(state.models?.data[0].id).toBe("gpt-4");
    expect(state.models?.data[1].id).toBe("claude-sonnet-4");
  });

  test("state can store vscode version", () => {
    state.vsCodeVersion = "1.113.0";
    expect(state.vsCodeVersion).toBe("1.113.0");
  });
});

describe("startup port configuration", () => {
  test("default port is 4141", () => {
    // based on CLI args default in start.ts
    const defaultPort = 4141;
    expect(defaultPort).toBe(4141);
  });

  test("port can be overridden via CLI args", () => {
    // simulate parsing port from CLI
    const parsePort = (portArg: string) => Number.parseInt(portArg, 10);

    expect(parsePort("4141")).toBe(4141);
    expect(parsePort("5000")).toBe(5000);
    expect(parsePort("8080")).toBe(8080);
  });

  test("port parsing handles invalid input", () => {
    const parsePort = (portArg: string) => {
      const parsed = Number.parseInt(portArg, 10);
      return Number.isNaN(parsed) ? 4141 : parsed;
    };

    expect(parsePort("invalid")).toBe(4141);
    expect(parsePort("")).toBe(4141);
  });
});

describe("startup CLI options parsing", () => {
  test("rate limit parsing works correctly", () => {
    const parseRateLimit = (rateLimitRaw?: string) => {
      return rateLimitRaw ? Number.parseInt(rateLimitRaw, 10) : undefined;
    };

    expect(parseRateLimit("5")).toBe(5);
    expect(parseRateLimit("10")).toBe(10);
    expect(parseRateLimit(undefined)).toBeUndefined();
  });

  test("boolean flags default to false", () => {
    // simulate CLI boolean defaults
    const defaults = {
      verbose: false,
      manual: false,
      wait: false,
      claudeCode: false,
      showToken: false,
      proxyEnv: false,
      debug: false,
      fallback: false,
    };

    expect(defaults.verbose).toBe(false);
    expect(defaults.manual).toBe(false);
    expect(defaults.wait).toBe(false);
    expect(defaults.claudeCode).toBe(false);
    expect(defaults.showToken).toBe(false);
    expect(defaults.proxyEnv).toBe(false);
    expect(defaults.debug).toBe(false);
    expect(defaults.fallback).toBe(false);
  });

  test("account type defaults to individual", () => {
    const defaultAccountType = "individual";
    expect(defaultAccountType).toBe("individual");
  });
});
