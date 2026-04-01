import { describe, expect, it } from "bun:test";

import {
  desanitizeToolId,
  sanitizeToolId,
} from "~/routes/messages/request-payload";

describe("sanitizeToolId", () => {
  it("should pass through valid alphanumeric IDs unchanged", () => {
    expect(sanitizeToolId("toolu_123abc")).toBe("toolu_123abc");
    expect(sanitizeToolId("call_abc123")).toBe("call_abc123");
    expect(sanitizeToolId("tool-use-id")).toBe("tool-use-id");
    expect(sanitizeToolId("tool_use_id")).toBe("tool_use_id");
    expect(sanitizeToolId("ABC123xyz")).toBe("ABC123xyz");
  });

  it("should encode IDs with invalid characters", () => {
    // IDs with dots should be encoded
    const idWithDot = "tool.use.id";
    const sanitized = sanitizeToolId(idWithDot);
    expect(sanitized).toMatch(/^toolu_x_/);
    expect(sanitized).not.toBe(idWithDot);

    // IDs with slashes should be encoded
    const idWithSlash = "tool/use/id";
    const sanitizedSlash = sanitizeToolId(idWithSlash);
    expect(sanitizedSlash).toMatch(/^toolu_x_/);
    expect(sanitizedSlash).not.toBe(idWithSlash);

    // IDs with special chars should be encoded
    const idWithSpecial = "tool@use#id";
    const sanitizedSpecial = sanitizeToolId(idWithSpecial);
    expect(sanitizedSpecial).toMatch(/^toolu_x_/);
    expect(sanitizedSpecial).not.toBe(idWithSpecial);
  });

  it("should generate ID for empty string", () => {
    const generated = sanitizeToolId("");
    expect(generated).toMatch(/^toolu_[a-f0-9]+$/);
    expect(generated.length).toBeGreaterThan(10);
  });
});

describe("desanitizeToolId", () => {
  it("should pass through IDs without encoded prefix unchanged", () => {
    expect(desanitizeToolId("toolu_123abc")).toBe("toolu_123abc");
    expect(desanitizeToolId("call_abc123")).toBe("call_abc123");
    expect(desanitizeToolId("regular-id")).toBe("regular-id");
  });

  it("should decode encoded IDs back to original", () => {
    const originalId = "tool.use.id/with@special#chars";
    const sanitized = sanitizeToolId(originalId);
    const desanitized = desanitizeToolId(sanitized);
    expect(desanitized).toBe(originalId);
  });

  it("should handle malformed encoded IDs gracefully", () => {
    // Invalid base64 should return the original ID
    expect(desanitizeToolId("toolu_x_!!!invalid!!!")).toBe(
      "toolu_x_!!!invalid!!!",
    );
    // Empty encoded portion should return original
    expect(desanitizeToolId("toolu_x_")).toBe("toolu_x_");
  });
});

describe("round-trip sanitization", () => {
  const testCases = [
    "normal_id",
    "tool-use-123",
    "toolu_abc123def",
    "id.with.dots",
    "id/with/slashes",
    "id@with@at",
    "id#with#hash",
    "complex.id/with@multiple#special$chars%",
    "unicode_日本語_id",
    "space in id",
    'quote"in"id',
  ];

  for (const originalId of testCases) {
    it(`should round-trip: ${originalId}`, () => {
      const sanitized = sanitizeToolId(originalId);
      // Sanitized ID should only contain valid chars
      expect(sanitized).toMatch(/^[a-zA-Z0-9_-]+$/);

      const desanitized = desanitizeToolId(sanitized);
      expect(desanitized).toBe(originalId);
    });
  }
});
