import { describe, it, expect } from "vitest";
import {
  analyzePrompt,
  resonanceTrendsPrompt,
  resonanceGeneratePrompt,
  REDUCK_PROMPTS,
  REDUCK_PROMPT_MAP,
  type PromptId,
} from "../index.js";
import type { ResonanceTrend } from "@breason/types";

describe("analyzePrompt", () => {
  it("includes market and text in output", () => {
    const result = analyzePrompt("brazil", "We deliver value.");
    expect(result).toContain("brazil");
    expect(result).toContain("We deliver value.");
  });

  it("instructs to return strict JSON", () => {
    const result = analyzePrompt("germany", "Test");
    expect(result.toLowerCase()).toContain("json");
    expect(result).toContain("score");
    expect(result).toContain("verdict");
  });

  it("does not leak any env vars", () => {
    const result = analyzePrompt("poland", "Test copy");
    expect(result).not.toContain("GEMINI");
    expect(result).not.toContain("API_KEY");
  });
});

describe("resonanceTrendsPrompt", () => {
  it("includes market in output", () => {
    expect(resonanceTrendsPrompt("poland")).toContain("poland");
  });

  it("asks for JSON trends array", () => {
    const result = resonanceTrendsPrompt("germany");
    expect(result).toContain("trends");
    expect(result.toLowerCase()).toContain("json");
  });
});

describe("resonanceGeneratePrompt", () => {
  const trend: ResonanceTrend = {
    title: "WhatsApp funnel",
    resonanceScore: 85,
    marketTension: "Speed vs trust",
    insight: "Quick replies convert.",
  };

  it("includes market and serialised trend", () => {
    const result = resonanceGeneratePrompt("brazil", trend);
    expect(result).toContain("brazil");
    expect(result).toContain("WhatsApp funnel");
  });

  it("specifies headline/body/cta keys", () => {
    const result = resonanceGeneratePrompt("brazil", trend);
    expect(result).toContain("headline");
    expect(result).toContain("body");
    expect(result).toContain("cta");
  });
});

describe("REDUCK_PROMPTS registry", () => {
  it("has exactly 4 prompts", () => {
    expect(REDUCK_PROMPTS).toHaveLength(4);
  });

  it("all prompts have valid meta ids with version", () => {
    for (const p of REDUCK_PROMPTS) {
      expect(p.meta.id).toMatch(/^reduck\/.+@\d+$/);
      expect(p.meta.id as PromptId).toBeTruthy();
    }
  });

  it("all prompts have non-empty systemPrompt", () => {
    for (const p of REDUCK_PROMPTS) {
      expect(p.systemPrompt.trim().length).toBeGreaterThan(50);
    }
  });

  it("REDUCK_PROMPT_MAP keys match short ids", () => {
    expect(REDUCK_PROMPT_MAP["lead-magnet"]).toBeDefined();
    expect(REDUCK_PROMPT_MAP["articles"]).toBeDefined();
    expect(REDUCK_PROMPT_MAP["editorial"]).toBeDefined();
    expect(REDUCK_PROMPT_MAP["localization"]).toBeDefined();
  });
});
