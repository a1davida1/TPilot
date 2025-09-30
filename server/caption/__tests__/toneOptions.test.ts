import { describe, expect, it } from "vitest";
import { extractToneOptions } from "../toneOptions";

describe("extractToneOptions", () => {
  it("trims supported tone keys", () => {
    const result = extractToneOptions({ style: "  playful  ", mood: " chill " });

    expect(result).toEqual({ style: "playful", mood: "chill" });
  });

  it("drops non-string tone values", () => {
    const result = extractToneOptions({ style: 42, mood: null });

    expect(result).toEqual({});
  });

  it("omits empty tone values after trimming", () => {
    const result = extractToneOptions({ style: "   ", mood: "" });

    expect(result).toEqual({});
  });

  it("ignores unsupported tone keys", () => {
    const result = extractToneOptions({
      style: "dramatic",
      mood: "bold",
      persona: "mischievous",
      energy: "high"
    });

    expect(result).toEqual({ style: "dramatic", mood: "bold" });
  });
});
