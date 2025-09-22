import { describe, it, expect } from "vitest";
import { inferFallbackFromFacts, ensureFallbackCompliance, type FallbackInferenceInput } from "../inferFallbackFromFacts";

describe("inferFallbackFromFacts", () => {
  describe("Platform-specific hashtag rules", () => {
    it("should generate correct hashtag count for Instagram", () => {
      const input: FallbackInferenceInput = {
        platform: "instagram",
        facts: { objects: ["camera", "sunset"], mood: "romantic" }
      };

      const result = inferFallbackFromFacts(input);
      
      expect(result.hashtags.length).toBeGreaterThanOrEqual(3);
      expect(result.hashtags.length).toBeLessThanOrEqual(8);
      expect(result.hashtags.every(tag => tag.startsWith("#"))).toBe(true);
    });

    it("should generate correct hashtag count for X (Twitter)", () => {
      const input: FallbackInferenceInput = {
        platform: "x",
        facts: { objects: ["coffee", "morning"], vibe: "energetic" }
      };

      const result = inferFallbackFromFacts(input);
      
      expect(result.hashtags.length).toBeGreaterThanOrEqual(1);
      expect(result.hashtags.length).toBeLessThanOrEqual(3);
      expect(result.hashtags.every(tag => tag.startsWith("#"))).toBe(true);
    });

    it("should generate correct hashtag format for Reddit", () => {
      const input: FallbackInferenceInput = {
        platform: "reddit",
        facts: { objects: ["discussion", "community"], topic: "technology" }
      };

      const result = inferFallbackFromFacts(input);
      
      expect(result.hashtags.length).toBeGreaterThanOrEqual(1);
      expect(result.hashtags.length).toBeLessThanOrEqual(3);
      // Reddit doesn't use # prefix
      expect(result.hashtags.every(tag => !tag.startsWith("#"))).toBe(true);
    });

    it("should generate correct hashtag count for TikTok", () => {
      const input: FallbackInferenceInput = {
        platform: "tiktok",
        facts: { objects: ["dance", "music"], style: "trendy" }
      };

      const result = inferFallbackFromFacts(input);
      
      expect(result.hashtags.length).toBeGreaterThanOrEqual(2);
      expect(result.hashtags.length).toBeLessThanOrEqual(5);
      expect(result.hashtags.every(tag => tag.startsWith("#"))).toBe(true);
    });
  });

  describe("Contextual CTA generation", () => {
    it("should generate beach-themed CTA for beach-related content", () => {
      const input: FallbackInferenceInput = {
        platform: "instagram",
        facts: { objects: ["beach", "ocean", "waves"], setting: "coastal" }
      };

      const result = inferFallbackFromFacts(input);
      
      expect(result.cta).toMatch(/beach|ocean|happy place/i);
    });

    it("should generate food-themed CTA for food content", () => {
      const input: FallbackInferenceInput = {
        platform: "instagram",
        facts: { objects: ["food", "recipe", "cooking"], category: "culinary" }
      };

      const result = inferFallbackFromFacts(input);
      
      expect(result.cta).toMatch(/try|favorite|hungry/i);
    });

    it("should generate platform-appropriate CTA when no specific context", () => {
      const input: FallbackInferenceInput = {
        platform: "x",
        facts: { objects: ["general", "content"] }
      };

      const result = inferFallbackFromFacts(input);
      
      expect(result.cta).toBeDefined();
      expect(result.cta.length).toBeGreaterThan(3);
    });
  });

  describe("Alt text generation", () => {
    it("should create descriptive alt text from facts", () => {
      const input: FallbackInferenceInput = {
        platform: "instagram",
        facts: { 
          objects: ["woman", "sunset", "mountain"],
          colors: ["golden", "orange"],
          mood: "peaceful"
        }
      };

      const result = inferFallbackFromFacts(input);
      
      expect(result.alt).toContain("woman");
      expect(result.alt).toContain("sunset");
      expect(result.alt).toContain("mountain");
      expect(result.alt.length).toBeGreaterThan(20);
    });

    it("should use theme when facts are sparse", () => {
      const input: FallbackInferenceInput = {
        platform: "instagram",
        theme: "minimalist photography"
      };

      const result = inferFallbackFromFacts(input);
      
      expect(result.alt).toContain("minimalist");
      expect(result.alt).toContain("photography");
    });

    it("should fallback to platform default when no context", () => {
      const input: FallbackInferenceInput = {
        platform: "reddit"
      };

      const result = inferFallbackFromFacts(input);
      
      expect(result.alt).toBeDefined();
      expect(result.alt.length).toBeGreaterThan(10);
    });
  });

  describe("Keyword extraction", () => {
    it("should extract meaningful keywords from complex facts", () => {
      const input: FallbackInferenceInput = {
        platform: "instagram",
        facts: {
          objects: ["professional", "camera", "photography"],
          settings: ["studio", "lighting", "setup"],
          emotions: ["creative", "inspiring", "artistic"],
          metadata: "ignore_this_metadata"
        }
      };

      const result = inferFallbackFromFacts(input);
      
      // Should extract keywords but not metadata
      const hashtagText = result.hashtags.join(" ");
      expect(hashtagText).toMatch(/camera|photography|studio|creative/i);
      expect(hashtagText).not.toContain("metadata");
    });

    it("should handle nested fact structures", () => {
      const input: FallbackInferenceInput = {
        platform: "instagram",
        facts: {
          scene: {
            primary: ["landscape", "nature"],
            secondary: ["trees", "sky"]
          },
          technical: {
            camera_settings: ["wide_angle", "golden_hour"],
            style: "vibrant"
          }
        }
      };

      const result = inferFallbackFromFacts(input);
      
      expect(result.hashtags.length).toBeGreaterThanOrEqual(3);
      // Should extract from nested structures
      const content = result.hashtags.join(" ") + result.alt;
      expect(content).toMatch(/landscape|nature|trees|vibrant/i);
    });
  });

  describe("Edge cases", () => {
    it("should handle empty facts gracefully", () => {
      const input: FallbackInferenceInput = {
        platform: "instagram",
        facts: {}
      };

      const result = inferFallbackFromFacts(input);
      
      expect(result.hashtags).toBeDefined();
      expect(result.hashtags.length).toBeGreaterThanOrEqual(3);
      expect(result.cta).toBeDefined();
      expect(result.alt).toBeDefined();
    });

    it("should handle null/undefined facts", () => {
      const input: FallbackInferenceInput = {
        platform: "tiktok"
      };

      const result = inferFallbackFromFacts(input);
      
      expect(result.hashtags).toBeDefined();
      expect(result.hashtags.length).toBeGreaterThanOrEqual(2);
      expect(result.cta).toBeDefined();
      expect(result.alt).toBeDefined();
    });

    it("should sanitize problematic characters in hashtags", () => {
      const input: FallbackInferenceInput = {
        platform: "instagram",
        facts: { objects: ["test@#$%", "special!chars*", "normal"] }
      };

      const result = inferFallbackFromFacts(input);
      
      result.hashtags.forEach(tag => {
        expect(tag).toMatch(/^#[a-zA-Z0-9]+$/);
      });
    });
  });
});

describe("ensureFallbackCompliance", () => {
  describe("Content validation and correction", () => {
    it("should preserve valid content", () => {
      const content = {
        caption: "Great photo today!",
        hashtags: ["#photography", "#sunset", "#nature"],
        cta: "What do you think?",
        alt: "Beautiful sunset over mountains with vibrant colors"
      };

      const params: FallbackInferenceInput = {
        platform: "instagram"
      };

      const result = ensureFallbackCompliance(content, params);
      
      expect(result.hashtags).toEqual(content.hashtags);
      expect(result.cta).toBe(content.cta);
      expect(result.alt).toBe(content.alt);
    });

    it("should fix insufficient hashtags", () => {
      const content = {
        hashtags: ["#one"] // Instagram needs 3-8
      };

      const params: FallbackInferenceInput = {
        platform: "instagram",
        facts: { objects: ["camera", "photo"] }
      };

      const result = ensureFallbackCompliance(content, params);
      
      expect(result.hashtags.length).toBeGreaterThanOrEqual(3);
      expect(result.hashtags).toContain("#one");
    });

    it("should replace invalid CTA", () => {
      const content = {
        cta: "x" // Too short
      };

      const params: FallbackInferenceInput = {
        platform: "x",
        facts: { mood: "energetic" }
      };

      const result = ensureFallbackCompliance(content, params);
      
      expect(result.cta.length).toBeGreaterThan(3);
    });

    it("should replace insufficient alt text", () => {
      const content = {
        alt: "pic" // Too short
      };

      const params: FallbackInferenceInput = {
        platform: "instagram",
        facts: { objects: ["landscape", "mountains"] }
      };

      const result = ensureFallbackCompliance(content, params);
      
      expect(result.alt.length).toBeGreaterThan(20);
      expect(result.alt).toMatch(/landscape|mountains/i);
    });

    it("should handle platform-specific hashtag formatting", () => {
      const content = {
        hashtags: ["community", "discussion", "tech"] // Reddit format (no #)
      };

      const params: FallbackInferenceInput = {
        platform: "reddit"
      };

      const result = ensureFallbackCompliance(content, params);
      
      result.hashtags.forEach(tag => {
        expect(tag).not.toMatch(/^#/);
      });
    });

    it("should convert hashtag formats between platforms", () => {
      const content = {
        hashtags: ["#photography", "#nature"] // Instagram format
      };

      const params: FallbackInferenceInput = {
        platform: "reddit" // Reddit doesn't use #
      };

      const result = ensureFallbackCompliance(content, params);
      
      result.hashtags.forEach(tag => {
        expect(tag).not.toMatch(/^#/);
      });
    });
  });

  describe("Context-aware fallbacks", () => {
    it("should use existing caption for context", () => {
      const content = {};

      const params: FallbackInferenceInput = {
        platform: "instagram",
        existingCaption: "Amazing beach sunset photography session today"
      };

      const result = ensureFallbackCompliance(content, params);
      
      // Should generate beach/sunset related content
      const allContent = result.hashtags.join(" ") + result.cta + result.alt;
      expect(allContent).toMatch(/beach|sunset|photography/i);
    });

    it("should prioritize facts over theme", () => {
      const content = {};

      const params: FallbackInferenceInput = {
        platform: "instagram",
        facts: { objects: ["mountain", "hiking"] },
        theme: "beach vacation"
      };

      const result = ensureFallbackCompliance(content, params);
      
      // Should prefer facts over theme
      const allContent = result.hashtags.join(" ") + result.alt;
      expect(allContent).toMatch(/mountain|hiking/i);
    });
  });
});