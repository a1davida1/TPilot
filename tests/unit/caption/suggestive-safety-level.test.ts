import { describe, it, expect } from 'vitest';
import { CaptionItem } from '../../../server/caption/schema.ts';

describe('Caption Generation Safety Levels', () => {
  describe('Suggestive Safety Level Acceptance', () => {
    it('should accept "suggestive" as valid safety_level', () => {
      const captionWithSuggestive = {
        caption: "Feeling confident and ready to take on the world! 💋",
        alt: "A confident content creator showcasing their personality",
        hashtags: ["#confidence", "#selfie", "#feelingmyself", "#mood"],
        cta: "What do you think?",
        mood: "confident",
        style: "flirty",
        safety_level: "suggestive",
        nsfw: false
      };

      // Should validate successfully with suggestive safety_level
      const result = CaptionItem.safeParse(captionWithSuggestive);
      expect(result.success).toBe(true);
      expect(result.data?.safety_level).toBe("suggestive");
    });

    it('should accept any string as safety_level', () => {
      const customSafetyLevels = [
        "mild",
        "spicy", 
        "adult",
        "explicit",
        "custom_level",
        "very_suggestive"
      ];

      customSafetyLevels.forEach(safetyLevel => {
        const caption = {
          caption: "Custom content with varying safety levels",
          alt: "Content that varies in suggestiveness",
          hashtags: ["#content", "#creative", "#custom"],
          cta: "Check it out",
          mood: "engaging", 
          style: "authentic",
          safety_level: safetyLevel,
          nsfw: false
        };

        const result = CaptionItem.safeParse(caption);
        expect(result.success).toBe(true);
        expect(result.data?.safety_level).toBe(safetyLevel);
      });
    });

    it('should not constrain safety_level to predefined enum values', () => {
      // Test that we're no longer restricted to ["normal","spicy_safe","needs_review"]
      const unconstrainedCaption = {
        caption: "This caption has an unrestricted safety level",
        alt: "Testing unrestricted safety level validation",
        hashtags: ["#testing", "#freedom", "#unrestricted"],
        cta: "Join the conversation",
        mood: "playful",
        style: "authentic", 
        safety_level: "completely_unrestricted_custom_level",
        nsfw: false
      };

      const result = CaptionItem.safeParse(unconstrainedCaption);
      expect(result.success).toBe(true);
      expect(result.data?.safety_level).toBe("completely_unrestricted_custom_level");
    });

    it('should require safety_level to be a string', () => {
      const invalidSafetyLevel = {
        caption: "Testing invalid safety level type",
        alt: "Caption with non-string safety level",
        hashtags: ["#testing", "#validation"],
        cta: "Check this",
        mood: "testing",
        style: "validation",
        safety_level: 123, // Invalid: number instead of string
        nsfw: false
      };

      const result = CaptionItem.safeParse(invalidSafetyLevel);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].path).toContain('safety_level');
    });
  });
});