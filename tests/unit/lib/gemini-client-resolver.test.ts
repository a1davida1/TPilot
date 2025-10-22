import { describe, it, expect } from "vitest";
import { resolveResponseText, extractTextFromCandidates } from "../../../server/lib/gemini-client";

describe("resolveResponseText for @google/genai shapes", () => {
  it("reads top-level text", async () => {
    const t = await resolveResponseText({ text: "Hello" });
    expect(t).toBe("Hello");
  });

  it("reads response.text() function", async () => {
    const t = await resolveResponseText({ response: { text: () => "Hi" } });
    expect(t).toBe("Hi");
  });

  it("flattens candidates.content.parts[].text", async () => {
    const payload = {
      candidates: [
        { content: { parts: [{ text: "A" }, { text: "B" }] } },
        { content: { parts: ["C"] } },
      ],
    };
    const flat = extractTextFromCandidates(payload);
    expect(flat).toBe("ABC");
    const t = await resolveResponseText(payload);
    expect(t).toBe("ABC");
  });
});
