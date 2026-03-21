import { describe, expect, it } from "bun:test"

import {
  generateTraceId,
  runWithContext,
  getRequestContext,
  getTraceId,
  type RequestContext,
} from "../request-context"

describe("generateTraceId", () => {
  it("should return a string", () => {
    const traceId = generateTraceId()
    expect(typeof traceId).toBe("string")
  })

  it("should return unique IDs on each call", () => {
    const ids = new Set<string>()
    for (let i = 0; i < 100; i++) {
      ids.add(generateTraceId())
    }
    // All 100 IDs should be unique
    expect(ids.size).toBe(100)
  })

  it("should follow the expected format (timestamp-random)", () => {
    const traceId = generateTraceId()
    // Format: base36timestamp-base36random (6 chars)
    expect(traceId).toMatch(/^[a-z0-9]+-[a-z0-9]{6}$/)
  })

  it("should contain a hyphen separator", () => {
    const traceId = generateTraceId()
    expect(traceId).toContain("-")
  })
})

describe("runWithContext", () => {
  it("should store context and make it available within the callback", () => {
    const context: RequestContext = {
      traceId: "test-trace-123",
      startTime: Date.now(),
    }

    let capturedContext: RequestContext | undefined

    runWithContext(context, () => {
      capturedContext = getRequestContext()
    })

    expect(capturedContext).toEqual(context)
  })

  it("should support optional sessionId and userId", () => {
    const context: RequestContext = {
      traceId: "test-trace-456",
      startTime: Date.now(),
      sessionId: "session-abc",
      userId: "user-xyz",
    }

    runWithContext(context, () => {
      const ctx = getRequestContext()
      expect(ctx?.sessionId).toBe("session-abc")
      expect(ctx?.userId).toBe("user-xyz")
    })
  })

  it("should return the value from the callback function", () => {
    const context: RequestContext = {
      traceId: "test-trace-789",
      startTime: Date.now(),
    }

    const result = runWithContext(context, () => {
      return "hello world"
    })

    expect(result).toBe("hello world")
  })

  it("should support async callbacks", async () => {
    const context: RequestContext = {
      traceId: "async-trace-123",
      startTime: Date.now(),
    }

    const result = await runWithContext(context, async () => {
      // Simulate async operation
      await new Promise((resolve) => {
        setTimeout(resolve, 10)
      })
      return getTraceId()
    })

    expect(result).toBe("async-trace-123")
  })

  it("should isolate context between nested calls", () => {
    const outerContext: RequestContext = {
      traceId: "outer-trace",
      startTime: Date.now(),
    }

    const innerContext: RequestContext = {
      traceId: "inner-trace",
      startTime: Date.now(),
    }

    let outerCaptured: string | undefined
    let innerCaptured: string | undefined

    runWithContext(outerContext, () => {
      outerCaptured = getTraceId()

      runWithContext(innerContext, () => {
        innerCaptured = getTraceId()
      })

      // After inner context exits, outer should be restored
      expect(getTraceId()).toBe("outer-trace")
    })

    expect(outerCaptured).toBe("outer-trace")
    expect(innerCaptured).toBe("inner-trace")
  })
})

describe("getRequestContext", () => {
  it("should return undefined when called outside of context", () => {
    const context = getRequestContext()
    expect(context).toBeUndefined()
  })

  it("should return the correct context when called inside runWithContext", () => {
    const expectedContext: RequestContext = {
      traceId: "context-test-trace",
      startTime: 1_234_567_890,
      sessionId: "session-123",
      userId: "user-456",
    }

    runWithContext(expectedContext, () => {
      const context = getRequestContext()
      expect(context).toEqual(expectedContext)
      expect(context?.traceId).toBe("context-test-trace")
      expect(context?.startTime).toBe(1_234_567_890)
      expect(context?.sessionId).toBe("session-123")
      expect(context?.userId).toBe("user-456")
    })
  })

  it("should return the same reference within the same context", () => {
    const expectedContext: RequestContext = {
      traceId: "same-ref-trace",
      startTime: Date.now(),
    }

    runWithContext(expectedContext, () => {
      const context1 = getRequestContext()
      const context2 = getRequestContext()
      expect(context1).toBe(context2)
    })
  })
})

describe("getTraceId", () => {
  it("should return undefined when called outside of context", () => {
    const traceId = getTraceId()
    expect(traceId).toBeUndefined()
  })

  it("should return the traceId when called inside context", () => {
    const context: RequestContext = {
      traceId: "specific-trace-id-abc",
      startTime: Date.now(),
    }

    runWithContext(context, () => {
      expect(getTraceId()).toBe("specific-trace-id-abc")
    })
  })

  it("should return correct traceId in async operations", async () => {
    const context: RequestContext = {
      traceId: "async-specific-trace",
      startTime: Date.now(),
    }

    await runWithContext(context, async () => {
      // First check
      expect(getTraceId()).toBe("async-specific-trace")

      // After async operation
      await new Promise((resolve) => {
        setTimeout(resolve, 5)
      })
      expect(getTraceId()).toBe("async-specific-trace")
    })
  })
})

describe("RequestContext interface", () => {
  it("should require traceId and startTime", () => {
    runWithContext(
      {
        traceId: "required-fields-test",
        startTime: Date.now(),
      },
      () => {
        const context = getRequestContext()
        expect(context?.traceId).toBeDefined()
        expect(context?.startTime).toBeDefined()
        expect(context?.sessionId).toBeUndefined()
        expect(context?.userId).toBeUndefined()
      },
    )
  })

  it("should allow optional sessionId and userId", () => {
    runWithContext(
      {
        traceId: "optional-fields-test",
        startTime: Date.now(),
        sessionId: "optional-session",
        userId: "optional-user",
      },
      () => {
        const context = getRequestContext()
        expect(context?.sessionId).toBe("optional-session")
        expect(context?.userId).toBe("optional-user")
      },
    )
  })
})
