/**
 * Unit tests for Claude Token Multiplier functionality
 * Tests that token counts are correctly inflated for Claude models
 */

import { describe, expect, test, beforeEach, mock } from "bun:test";

import { calculateCost, getModelPricing } from "../lib/cost-calculator";
import { getClaudeTokenMultiplier } from "../lib/config";

describe("getClaudeTokenMultiplier", () => {
  test("should return default value of 1.15", () => {
    const multiplier = getClaudeTokenMultiplier();
    expect(multiplier).toBe(1.15);
  });

  test("should return a number type", () => {
    const multiplier = getClaudeTokenMultiplier();
    expect(typeof multiplier).toBe("number");
  });

  test("should return a positive number greater than 0", () => {
    const multiplier = getClaudeTokenMultiplier();
    expect(multiplier).toBeGreaterThan(0);
  });
});

describe("calculateCost with Claude token multiplier", () => {
  const inputTokens = 1000;
  const outputTokens = 500;

  describe("Claude models - multiplier SHOULD be applied", () => {
    test("claude-3.5-sonnet applies 1.15x multiplier to tokens", () => {
      const result = calculateCost(
        "claude-3.5-sonnet",
        inputTokens,
        outputTokens,
      );

      // Multiplier 1.15 applied: 1000 * 1.15 = 1150, 500 * 1.15 = 575
      expect(result.inputTokens).toBe(Math.round(inputTokens * 1.15));
      expect(result.outputTokens).toBe(Math.round(outputTokens * 1.15));
      expect(result.inputTokens).toBe(1150);
      expect(result.outputTokens).toBe(575);
    });

    test("claude-3-opus applies 1.15x multiplier to tokens", () => {
      const result = calculateCost("claude-3-opus", inputTokens, outputTokens);

      expect(result.inputTokens).toBe(Math.round(inputTokens * 1.15));
      expect(result.outputTokens).toBe(Math.round(outputTokens * 1.15));
    });

    test("claude-sonnet-4 applies 1.15x multiplier to tokens", () => {
      const result = calculateCost(
        "claude-sonnet-4",
        inputTokens,
        outputTokens,
      );

      expect(result.inputTokens).toBe(1150);
      expect(result.outputTokens).toBe(575);
    });

    test("claude-sonnet-4.5 applies 1.15x multiplier to tokens", () => {
      const result = calculateCost(
        "claude-sonnet-4.5",
        inputTokens,
        outputTokens,
      );

      expect(result.inputTokens).toBe(1150);
      expect(result.outputTokens).toBe(575);
    });

    test("claude-opus-4.5 applies 1.15x multiplier to tokens", () => {
      const result = calculateCost(
        "claude-opus-4.5",
        inputTokens,
        outputTokens,
      );

      expect(result.inputTokens).toBe(1150);
      expect(result.outputTokens).toBe(575);
    });

    test("claude-opus-4.6 applies 1.15x multiplier to tokens", () => {
      const result = calculateCost(
        "claude-opus-4.6",
        inputTokens,
        outputTokens,
      );

      expect(result.inputTokens).toBe(1150);
      expect(result.outputTokens).toBe(575);
    });

    test("claude-haiku-4.5 applies 1.15x multiplier to tokens", () => {
      const result = calculateCost(
        "claude-haiku-4.5",
        inputTokens,
        outputTokens,
      );

      expect(result.inputTokens).toBe(1150);
      expect(result.outputTokens).toBe(575);
    });

    test("claude-3-haiku applies 1.15x multiplier to tokens", () => {
      const result = calculateCost("claude-3-haiku", inputTokens, outputTokens);

      expect(result.inputTokens).toBe(1150);
      expect(result.outputTokens).toBe(575);
    });

    test("claude-3-sonnet applies 1.15x multiplier to tokens", () => {
      const result = calculateCost(
        "claude-3-sonnet",
        inputTokens,
        outputTokens,
      );

      expect(result.inputTokens).toBe(1150);
      expect(result.outputTokens).toBe(575);
    });
  });

  describe("Non-Claude models - multiplier should NOT be applied", () => {
    test("gpt-4o does NOT apply multiplier", () => {
      const result = calculateCost("gpt-4o", inputTokens, outputTokens);

      expect(result.inputTokens).toBe(inputTokens);
      expect(result.outputTokens).toBe(outputTokens);
      expect(result.inputTokens).toBe(1000);
      expect(result.outputTokens).toBe(500);
    });

    test("gpt-4o-mini does NOT apply multiplier", () => {
      const result = calculateCost("gpt-4o-mini", inputTokens, outputTokens);

      expect(result.inputTokens).toBe(inputTokens);
      expect(result.outputTokens).toBe(outputTokens);
    });

    test("gpt-4.1 does NOT apply multiplier", () => {
      const result = calculateCost("gpt-4.1", inputTokens, outputTokens);

      expect(result.inputTokens).toBe(inputTokens);
      expect(result.outputTokens).toBe(outputTokens);
    });

    test("gpt-4.1-mini does NOT apply multiplier", () => {
      const result = calculateCost("gpt-4.1-mini", inputTokens, outputTokens);

      expect(result.inputTokens).toBe(inputTokens);
      expect(result.outputTokens).toBe(outputTokens);
    });

    test("gpt-4-turbo does NOT apply multiplier", () => {
      const result = calculateCost("gpt-4-turbo", inputTokens, outputTokens);

      expect(result.inputTokens).toBe(inputTokens);
      expect(result.outputTokens).toBe(outputTokens);
    });

    test("gpt-3.5-turbo does NOT apply multiplier", () => {
      const result = calculateCost("gpt-3.5-turbo", inputTokens, outputTokens);

      expect(result.inputTokens).toBe(inputTokens);
      expect(result.outputTokens).toBe(outputTokens);
    });

    test("gpt-5 does NOT apply multiplier", () => {
      const result = calculateCost("gpt-5", inputTokens, outputTokens);

      expect(result.inputTokens).toBe(inputTokens);
      expect(result.outputTokens).toBe(outputTokens);
    });

    test("gpt-5-mini does NOT apply multiplier", () => {
      const result = calculateCost("gpt-5-mini", inputTokens, outputTokens);

      expect(result.inputTokens).toBe(inputTokens);
      expect(result.outputTokens).toBe(outputTokens);
    });

    test("o1-preview does NOT apply multiplier", () => {
      const result = calculateCost("o1-preview", inputTokens, outputTokens);

      expect(result.inputTokens).toBe(inputTokens);
      expect(result.outputTokens).toBe(outputTokens);
    });

    test("o1-mini does NOT apply multiplier", () => {
      const result = calculateCost("o1-mini", inputTokens, outputTokens);

      expect(result.inputTokens).toBe(inputTokens);
      expect(result.outputTokens).toBe(outputTokens);
    });

    test("o3-mini does NOT apply multiplier", () => {
      const result = calculateCost("o3-mini", inputTokens, outputTokens);

      expect(result.inputTokens).toBe(inputTokens);
      expect(result.outputTokens).toBe(outputTokens);
    });

    test("gemini-2.0-flash does NOT apply multiplier", () => {
      const result = calculateCost(
        "gemini-2.0-flash",
        inputTokens,
        outputTokens,
      );

      expect(result.inputTokens).toBe(inputTokens);
      expect(result.outputTokens).toBe(outputTokens);
    });

    test("gemini-1.5-pro does NOT apply multiplier", () => {
      const result = calculateCost("gemini-1.5-pro", inputTokens, outputTokens);

      expect(result.inputTokens).toBe(inputTokens);
      expect(result.outputTokens).toBe(outputTokens);
    });
  });

  describe("Token inflation calculation verification", () => {
    test("multiplier inflation is exactly 15%", () => {
      const multiplier = getClaudeTokenMultiplier();
      const inflationPercent = (multiplier - 1) * 100;

      // Use toBeCloseTo to handle floating point precision
      expect(inflationPercent).toBeCloseTo(15, 10);
    });

    test("large token counts are inflated correctly", () => {
      const largeInput = 100000;
      const largeOutput = 50000;
      const result = calculateCost(
        "claude-sonnet-4.5",
        largeInput,
        largeOutput,
      );

      expect(result.inputTokens).toBe(Math.round(largeInput * 1.15));
      expect(result.outputTokens).toBe(Math.round(largeOutput * 1.15));
      expect(result.inputTokens).toBe(115000);
      expect(result.outputTokens).toBe(57500);
    });

    test("small token counts are inflated correctly with rounding", () => {
      const smallInput = 7;
      const smallOutput = 3;
      const result = calculateCost(
        "claude-3.5-sonnet",
        smallInput,
        smallOutput,
      );

      // 7 * 1.15 = 8.05 -> rounds to 8
      // 3 * 1.15 = 3.45 -> rounds to 3
      expect(result.inputTokens).toBe(Math.round(smallInput * 1.15));
      expect(result.outputTokens).toBe(Math.round(smallOutput * 1.15));
    });

    test("zero tokens remain zero after multiplier", () => {
      const result = calculateCost("claude-sonnet-4", 0, 0);

      expect(result.inputTokens).toBe(0);
      expect(result.outputTokens).toBe(0);
    });
  });

  describe("Cost calculation with inflated tokens", () => {
    test("Claude model cost is calculated based on inflated token count", () => {
      // claude-3.5-sonnet pricing: input $3/1M, output $15/1M
      const pricing = getModelPricing("claude-3.5-sonnet");
      expect(pricing).not.toBeNull();
      expect(pricing!.inputCostPer1M).toBe(3.0);
      expect(pricing!.outputCostPer1M).toBe(15.0);

      const result = calculateCost("claude-3.5-sonnet", 1000000, 100000);

      // Inflated: 1150000 input, 115000 output
      // Input cost: 1150000 / 1M * $3 = $3.45
      // Output cost: 115000 / 1M * $15 = $1.725
      expect(result.inputTokens).toBe(1150000);
      expect(result.outputTokens).toBe(115000);
      expect(result.inputCost).toBeCloseTo(3.45, 4);
      expect(result.outputCost).toBeCloseTo(1.725, 4);
      expect(result.totalCost).toBeCloseTo(5.175, 4);
    });

    test("GPT model cost is calculated based on original token count (no inflation)", () => {
      // gpt-4o pricing: input $2.5/1M, output $10/1M
      const pricing = getModelPricing("gpt-4o");
      expect(pricing).not.toBeNull();
      expect(pricing!.inputCostPer1M).toBe(2.5);
      expect(pricing!.outputCostPer1M).toBe(10.0);

      const result = calculateCost("gpt-4o", 1000000, 100000);

      // No inflation: 1000000 input, 100000 output
      // Input cost: 1000000 / 1M * $2.5 = $2.5
      // Output cost: 100000 / 1M * $10 = $1.0
      expect(result.inputTokens).toBe(1000000);
      expect(result.outputTokens).toBe(100000);
      expect(result.inputCost).toBeCloseTo(2.5, 4);
      expect(result.outputCost).toBeCloseTo(1.0, 4);
      expect(result.totalCost).toBeCloseTo(3.5, 4);
    });
  });

  describe("Edge cases", () => {
    test("unknown model returns zero cost and no multiplier applied", () => {
      const result = calculateCost("unknown-model", inputTokens, outputTokens);

      expect(result.inputTokens).toBe(inputTokens);
      expect(result.outputTokens).toBe(outputTokens);
      expect(result.inputCost).toBe(0);
      expect(result.outputCost).toBe(0);
      expect(result.totalCost).toBe(0);
    });

    test("unknown claude model returns early without multiplier (no pricing)", () => {
      // Model starting with 'claude' but not in pricing
      // Returns early because getModelPricing returns null
      // This means multiplier is NOT applied for unknown models
      const result = calculateCost(
        "claude-future-model-xyz",
        inputTokens,
        outputTokens,
      );

      // No pricing found = return early with original tokens
      expect(result.inputTokens).toBe(inputTokens);
      expect(result.outputTokens).toBe(outputTokens);
      expect(result.inputCost).toBe(0);
      expect(result.outputCost).toBe(0);
      expect(result.totalCost).toBe(0);
    });

    test("model containing 'claude' but not starting with it does NOT apply multiplier", () => {
      // Only models STARTING with 'claude' should get multiplier
      const result = calculateCost(
        "my-claude-clone",
        inputTokens,
        outputTokens,
      );

      expect(result.inputTokens).toBe(inputTokens);
      expect(result.outputTokens).toBe(outputTokens);
    });
  });

  describe("CostEstimate response structure", () => {
    test("returns correct structure for Claude model", () => {
      const result = calculateCost("claude-sonnet-4", 1000, 500);

      expect(result).toHaveProperty("model");
      expect(result).toHaveProperty("inputTokens");
      expect(result).toHaveProperty("outputTokens");
      expect(result).toHaveProperty("inputCost");
      expect(result).toHaveProperty("outputCost");
      expect(result).toHaveProperty("totalCost");
      expect(result).toHaveProperty("currency");
      expect(result.model).toBe("claude-sonnet-4");
      expect(result.currency).toBe("USD");
    });

    test("returns correct structure for GPT model", () => {
      const result = calculateCost("gpt-4o", 1000, 500);

      expect(result).toHaveProperty("model");
      expect(result).toHaveProperty("inputTokens");
      expect(result).toHaveProperty("outputTokens");
      expect(result).toHaveProperty("inputCost");
      expect(result).toHaveProperty("outputCost");
      expect(result).toHaveProperty("totalCost");
      expect(result).toHaveProperty("currency");
      expect(result.model).toBe("gpt-4o");
      expect(result.currency).toBe("USD");
    });
  });
});
