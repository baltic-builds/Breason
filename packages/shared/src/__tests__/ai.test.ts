import { describe, it, expect, vi, beforeEach } from "vitest";
import { softJson } from "../ai.js";

// NOTE: callAiWithFallback is tested via integration-style mocking.
// softJson is pure and can be unit-tested without mocks.

describe("softJson", () => {
  it("parses clean JSON", () => {
    const result = softJson<{ score: number }>('{"score": 75}');
    expect(result?.score).toBe(75);
  });

  it("strips markdown fences", () => {
    const raw = "```json\n{\"score\": 80}\n```";
    const result = softJson<{ score: number }>(raw);
    expect(result?.score).toBe(80);
  });

  it("extracts JSON from surrounding prose", () => {
    const raw = 'Here is the result:\n{"score": 65, "verdict": "PASS"}\nDone.';
    const result = softJson<{ score: number; verdict: string }>(raw);
    expect(result?.score).toBe(65);
    expect(result?.verdict).toBe("PASS");
  });

  it("returns null for non-JSON", () => {
    expect(softJson("This is just plain text")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(softJson("")).toBeNull();
  });

  it("handles nested objects", () => {
    const raw = '{"trends": [{"title": "Test", "resonanceScore": 90}]}';
    const result = softJson<{ trends: Array<{ title: string; resonanceScore: number }> }>(raw);
    expect(result?.trends?.[0]?.title).toBe("Test");
  });
});

describe("callAiWithFallback - provider selection", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses local fallback when no API keys are set", async () => {
    // All env vars unset
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.stubEnv("OPENROUTER_API_KEY", "");
    vi.stubEnv("GROQ_API_KEY", "");

    const { callAiWithFallback } = await import("../ai.js");
    const result = await callAiWithFallback("test prompt", "test@1");

    expect(result.provider).toBe("local");
    expect(result.text).toBe("");
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });
});
