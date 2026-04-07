import { beforeEach, describe, expect, it, mock } from "bun:test";

import {
  adjustUsageTokens,
  getProviderConfig,
} from "~/routes/provider/messages/handler";

// Mock getConfig from config module
const mockConfig = mock(() => ({}));

mock.module("~/lib/config", () => ({
  getConfig: mockConfig,
}));

describe("adjustUsageTokens", () => {
  describe("when body has no usage field", () => {
    it("should return body unchanged when usage is undefined", () => {
      const body: Record<string, unknown> = {
        id: "msg_123",
        model: "claude-3-opus",
        content: [{ type: "text", text: "Hello" }],
      };

      const result = adjustUsageTokens(body);

      expect(result).toEqual(body);
      expect(result.usage).toBeUndefined();
    });

    it("should return body unchanged when usage is null", () => {
      const body: Record<string, unknown> = {
        id: "msg_123",
        usage: null,
      };

      const result = adjustUsageTokens(body);

      expect(result).toEqual(body);
      expect(result.usage).toBeNull();
    });
  });

  describe("when body has usage field", () => {
    it("should subtract cache_read_input_tokens from input_tokens", () => {
      const body: Record<string, unknown> = {
        id: "msg_123",
        usage: {
          input_tokens: 1000,
          output_tokens: 500,
          cache_read_input_tokens: 300,
        },
      };

      const result = adjustUsageTokens(body);

      const usage = result.usage as Record<string, number>;
      expect(usage.input_tokens).toBe(700); // 1000 - 300
      expect(usage.output_tokens).toBe(500); // unchanged
      expect(usage.cache_read_input_tokens).toBe(300); // unchanged
    });

    it("should not go below 0 when cache_read_input_tokens exceeds input_tokens", () => {
      const body: Record<string, unknown> = {
        id: "msg_123",
        usage: {
          input_tokens: 100,
          output_tokens: 200,
          cache_read_input_tokens: 500,
        },
      };

      const result = adjustUsageTokens(body);

      const usage = result.usage as Record<string, number>;
      expect(usage.input_tokens).toBe(0); // Math.max(0, 100 - 500)
    });

    it("should handle exact match of input_tokens and cache_read_input_tokens", () => {
      const body: Record<string, unknown> = {
        id: "msg_123",
        usage: {
          input_tokens: 500,
          output_tokens: 100,
          cache_read_input_tokens: 500,
        },
      };

      const result = adjustUsageTokens(body);

      const usage = result.usage as Record<string, number>;
      expect(usage.input_tokens).toBe(0);
    });

    it("should not modify input_tokens when cache_read_input_tokens is missing", () => {
      const body: Record<string, unknown> = {
        id: "msg_123",
        usage: {
          input_tokens: 1000,
          output_tokens: 500,
        },
      };

      const result = adjustUsageTokens(body);

      const usage = result.usage as Record<string, number>;
      expect(usage.input_tokens).toBe(1000); // unchanged
    });

    it("should not modify input_tokens when cache_read_input_tokens is not a number", () => {
      const body: Record<string, unknown> = {
        id: "msg_123",
        usage: {
          input_tokens: 1000,
          output_tokens: 500,
          cache_read_input_tokens: "300", // string, not number
        },
      };

      const result = adjustUsageTokens(body);

      const usage = result.usage as Record<string, number>;
      expect(usage.input_tokens).toBe(1000); // unchanged
    });

    it("should not modify when input_tokens is not a number", () => {
      const body: Record<string, unknown> = {
        id: "msg_123",
        usage: {
          input_tokens: "1000", // string, not number
          output_tokens: 500,
          cache_read_input_tokens: 300,
        },
      };

      const result = adjustUsageTokens(body);

      const usage = result.usage as Record<string, unknown>;
      expect(usage.input_tokens).toBe("1000"); // unchanged
    });

    it("should handle zero input_tokens", () => {
      const body: Record<string, unknown> = {
        id: "msg_123",
        usage: {
          input_tokens: 0,
          output_tokens: 100,
          cache_read_input_tokens: 0,
        },
      };

      const result = adjustUsageTokens(body);

      const usage = result.usage as Record<string, number>;
      expect(usage.input_tokens).toBe(0);
    });

    it("should handle zero cache_read_input_tokens", () => {
      const body: Record<string, unknown> = {
        id: "msg_123",
        usage: {
          input_tokens: 1000,
          output_tokens: 100,
          cache_read_input_tokens: 0,
        },
      };

      const result = adjustUsageTokens(body);

      const usage = result.usage as Record<string, number>;
      expect(usage.input_tokens).toBe(1000); // 1000 - 0
    });

    it("should preserve other usage fields", () => {
      const body: Record<string, unknown> = {
        id: "msg_123",
        usage: {
          input_tokens: 1000,
          output_tokens: 500,
          cache_read_input_tokens: 300,
          cache_creation_input_tokens: 200,
          total_tokens: 1500,
        },
      };

      const result = adjustUsageTokens(body);

      const usage = result.usage as Record<string, number>;
      expect(usage.input_tokens).toBe(700);
      expect(usage.output_tokens).toBe(500);
      expect(usage.cache_read_input_tokens).toBe(300);
      expect(usage.cache_creation_input_tokens).toBe(200);
      expect(usage.total_tokens).toBe(1500); // unchanged
    });
  });

  describe("edge cases", () => {
    it("should handle empty body object", () => {
      const body: Record<string, unknown> = {};

      const result = adjustUsageTokens(body);

      expect(result).toEqual({});
    });

    it("should handle body with empty usage object", () => {
      const body: Record<string, unknown> = {
        id: "msg_123",
        usage: {},
      };

      const result = adjustUsageTokens(body);

      expect(result.usage).toEqual({});
    });

    it("should return same reference (mutates in place)", () => {
      const body: Record<string, unknown> = {
        id: "msg_123",
        usage: {
          input_tokens: 1000,
          cache_read_input_tokens: 300,
        },
      };

      const result = adjustUsageTokens(body);

      expect(result).toBe(body);
    });

    it("should handle large token values", () => {
      const body: Record<string, unknown> = {
        id: "msg_123",
        usage: {
          input_tokens: 1000000,
          output_tokens: 500000,
          cache_read_input_tokens: 750000,
        },
      };

      const result = adjustUsageTokens(body);

      const usage = result.usage as Record<string, number>;
      expect(usage.input_tokens).toBe(250000); // 1000000 - 750000
    });

    it("should handle negative cache_read_input_tokens (edge case)", () => {
      const body: Record<string, unknown> = {
        id: "msg_123",
        usage: {
          input_tokens: 1000,
          output_tokens: 500,
          cache_read_input_tokens: -100,
        },
      };

      const result = adjustUsageTokens(body);

      const usage = result.usage as Record<string, number>;
      // 1000 - (-100) = 1100, but this is unusual
      expect(usage.input_tokens).toBe(1100);
    });
  });
});

describe("getProviderConfig", () => {
  beforeEach(() => {
    mockConfig.mockReset();
  });

  describe("provider type validation", () => {
    it('should return null when provider type is not "anthropic"', () => {
      mockConfig.mockReturnValue({
        providers: {
          openai: {
            type: "openai",
            enabled: true,
            baseUrl: "https://api.openai.com",
            apiKey: "sk-test",
          },
        },
      });

      const result = getProviderConfig("openai");

      expect(result).toBeNull();
    });

    it('should return config when provider type is "anthropic"', () => {
      mockConfig.mockReturnValue({
        providers: {
          myanthro: {
            type: "anthropic",
            enabled: true,
            baseUrl: "https://api.anthropic.com",
            apiKey: "sk-ant-test",
          },
        },
      });

      const result = getProviderConfig("myanthro");

      expect(result).not.toBeNull();
      expect(result?.type).toBe("anthropic");
      expect(result?.name).toBe("myanthro");
    });

    it("should return null for unsupported provider types", () => {
      mockConfig.mockReturnValue({
        providers: {
          cohere: {
            type: "cohere",
            enabled: true,
            baseUrl: "https://api.cohere.ai",
            apiKey: "cohere-key",
          },
        },
      });

      const result = getProviderConfig("cohere");

      expect(result).toBeNull();
    });

    it("should return null for provider with empty type", () => {
      mockConfig.mockReturnValue({
        providers: {
          empty: {
            type: "",
            enabled: true,
            baseUrl: "https://api.example.com",
            apiKey: "key",
          },
        },
      });

      const result = getProviderConfig("empty");

      expect(result).toBeNull();
    });
  });

  describe("required field validation", () => {
    it("should return null when baseUrl is missing", () => {
      mockConfig.mockReturnValue({
        providers: {
          anthropic: {
            type: "anthropic",
            enabled: true,
            baseUrl: "",
            apiKey: "sk-ant-test",
          },
        },
      });

      const result = getProviderConfig("anthropic");

      expect(result).toBeNull();
    });

    it("should return null when apiKey is missing", () => {
      mockConfig.mockReturnValue({
        providers: {
          anthropic: {
            type: "anthropic",
            enabled: true,
            baseUrl: "https://api.anthropic.com",
            apiKey: "",
          },
        },
      });

      const result = getProviderConfig("anthropic");

      expect(result).toBeNull();
    });

    it("should return null when both baseUrl and apiKey are missing", () => {
      mockConfig.mockReturnValue({
        providers: {
          anthropic: {
            type: "anthropic",
            enabled: true,
            baseUrl: "",
            apiKey: "",
          },
        },
      });

      const result = getProviderConfig("anthropic");

      expect(result).toBeNull();
    });

    it("should return null when baseUrl is undefined", () => {
      mockConfig.mockReturnValue({
        providers: {
          anthropic: {
            type: "anthropic",
            enabled: true,
            apiKey: "sk-ant-test",
          },
        },
      });

      const result = getProviderConfig("anthropic");

      expect(result).toBeNull();
    });

    it("should return null when apiKey is undefined", () => {
      mockConfig.mockReturnValue({
        providers: {
          anthropic: {
            type: "anthropic",
            enabled: true,
            baseUrl: "https://api.anthropic.com",
          },
        },
      });

      const result = getProviderConfig("anthropic");

      expect(result).toBeNull();
    });

    it("should return config when both baseUrl and apiKey are present", () => {
      mockConfig.mockReturnValue({
        providers: {
          anthropic: {
            type: "anthropic",
            enabled: true,
            baseUrl: "https://api.anthropic.com",
            apiKey: "sk-ant-test",
          },
        },
      });

      const result = getProviderConfig("anthropic");

      expect(result).not.toBeNull();
      expect(result?.baseUrl).toBe("https://api.anthropic.com");
      expect(result?.apiKey).toBe("sk-ant-test");
    });
  });

  describe("provider enabled status", () => {
    it("should return null when provider is disabled", () => {
      mockConfig.mockReturnValue({
        providers: {
          anthropic: {
            type: "anthropic",
            enabled: false,
            baseUrl: "https://api.anthropic.com",
            apiKey: "sk-ant-test",
          },
        },
      });

      const result = getProviderConfig("anthropic");

      expect(result).toBeNull();
    });

    it("should return config when provider is enabled", () => {
      mockConfig.mockReturnValue({
        providers: {
          anthropic: {
            type: "anthropic",
            enabled: true,
            baseUrl: "https://api.anthropic.com",
            apiKey: "sk-ant-test",
          },
        },
      });

      const result = getProviderConfig("anthropic");

      expect(result).not.toBeNull();
      expect(result?.enabled).toBe(true);
    });
  });

  describe("provider existence", () => {
    it("should return null when providers config is undefined", () => {
      mockConfig.mockReturnValue({});

      const result = getProviderConfig("anthropic");

      expect(result).toBeNull();
    });

    it("should return null when provider name does not exist", () => {
      mockConfig.mockReturnValue({
        providers: {
          other: {
            type: "anthropic",
            enabled: true,
            baseUrl: "https://api.example.com",
            apiKey: "key",
          },
        },
      });

      const result = getProviderConfig("anthropic");

      expect(result).toBeNull();
    });

    it("should return null when provider is null", () => {
      mockConfig.mockReturnValue({
        providers: {
          anthropic: null,
        },
      });

      const result = getProviderConfig("anthropic");

      expect(result).toBeNull();
    });

    it("should return null when provider is undefined", () => {
      mockConfig.mockReturnValue({
        providers: {
          anthropic: undefined,
        },
      });

      const result = getProviderConfig("anthropic");

      expect(result).toBeNull();
    });
  });

  describe("additional config fields", () => {
    it("should include adjustInputTokens when present", () => {
      mockConfig.mockReturnValue({
        providers: {
          anthropic: {
            type: "anthropic",
            enabled: true,
            baseUrl: "https://api.anthropic.com",
            apiKey: "sk-ant-test",
            adjustInputTokens: true,
          },
        },
      });

      const result = getProviderConfig("anthropic");

      expect(result?.adjustInputTokens).toBe(true);
    });

    it("should include models config when present", () => {
      mockConfig.mockReturnValue({
        providers: {
          anthropic: {
            type: "anthropic",
            enabled: true,
            baseUrl: "https://api.anthropic.com",
            apiKey: "sk-ant-test",
            models: {
              "claude-3-opus": {
                temperature: 0.7,
                topP: 0.9,
                topK: 40,
              },
            },
          },
        },
      });

      const result = getProviderConfig("anthropic");

      expect(result?.models).toBeDefined();
      expect(result?.models?.["claude-3-opus"]?.temperature).toBe(0.7);
    });

    it("should add name field to returned config", () => {
      mockConfig.mockReturnValue({
        providers: {
          myProvider: {
            type: "anthropic",
            enabled: true,
            baseUrl: "https://api.example.com",
            apiKey: "key",
          },
        },
      });

      const result = getProviderConfig("myProvider");

      expect(result?.name).toBe("myProvider");
    });
  });

  describe("edge cases", () => {
    it("should handle empty provider name", () => {
      mockConfig.mockReturnValue({
        providers: {
          "": {
            type: "anthropic",
            enabled: true,
            baseUrl: "https://api.anthropic.com",
            apiKey: "sk-ant-test",
          },
        },
      });

      const result = getProviderConfig("");

      expect(result).not.toBeNull();
      expect(result?.name).toBe("");
    });

    it("should handle special characters in provider name", () => {
      mockConfig.mockReturnValue({
        providers: {
          "my-provider_v2.1": {
            type: "anthropic",
            enabled: true,
            baseUrl: "https://api.anthropic.com",
            apiKey: "sk-ant-test",
          },
        },
      });

      const result = getProviderConfig("my-provider_v2.1");

      expect(result).not.toBeNull();
      expect(result?.name).toBe("my-provider_v2.1");
    });

    it("should handle multiple providers and return correct one", () => {
      mockConfig.mockReturnValue({
        providers: {
          provider1: {
            type: "anthropic",
            enabled: true,
            baseUrl: "https://api.provider1.com",
            apiKey: "key1",
          },
          provider2: {
            type: "anthropic",
            enabled: true,
            baseUrl: "https://api.provider2.com",
            apiKey: "key2",
          },
        },
      });

      const result = getProviderConfig("provider2");

      expect(result).not.toBeNull();
      expect(result?.baseUrl).toBe("https://api.provider2.com");
      expect(result?.apiKey).toBe("key2");
    });
  });
});
