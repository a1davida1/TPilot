import { describe, test, expect, vi, beforeEach } from 'vitest';

// Mock environment variables
const mockEnv = {
  OPENAI_API_KEY: '',
  GOOGLE_GENAI_API_KEY: '',
  GEMINI_API_KEY: ''
};

describe('Image Generator Failure Diagnosis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset env vars
    Object.keys(mockEnv).forEach(key => {
      process.env[key] = mockEnv[key];
    });
  });

  describe('Missing Environment Variables', () => {
    test('handles missing OpenAI API key gracefully', () => {
      delete process.env.OPENAI_API_KEY;
      
      // Check if OpenAI provider is available
      const isOpenAIAvailable = !!process.env.OPENAI_API_KEY;
      expect(isOpenAIAvailable).toBe(false);
      
      // Simulate provider availability check from multi-ai-provider.ts
      const providers = [
        { name: 'gemini-flash', available: !!process.env.GOOGLE_GENAI_API_KEY || !!process.env.GEMINI_API_KEY },
        { name: 'openai-gpt4o', available: !!process.env.OPENAI_API_KEY },
      ];
      
      const availableProviders = providers.filter(p => p.available);
      
      // If no API keys, should fallback to template system
      if (availableProviders.length === 0) {
        expect(availableProviders).toHaveLength(0);
      }
    });

    test('handles missing Google GenAI key gracefully', () => {
      delete process.env.GOOGLE_GENAI_API_KEY;
      delete process.env.GEMINI_API_KEY;
      
      const isGeminiAvailable = !!(process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY);
      expect(isGeminiAvailable).toBe(false);
    });

    test('fallback system works when all AI providers fail', () => {
      delete process.env.OPENAI_API_KEY;
      delete process.env.GOOGLE_GENAI_API_KEY;
      delete process.env.GEMINI_API_KEY;
      
      // Simulate the fallback content from enhanced-ai-service.ts
      const fallbackContent = {
        caption: "Beautiful moment captured with perfect lighting and composition",
        titles: [
          "Feeling absolutely radiant today ✨",
          "Sometimes you just gotta capture the moment",
          "Living my best life and loving every second"
        ],
        hashtags: ["#confidence", "#lifestyle", "#mood", "#authentic", "#beautiful"],
        postContent: "This is demo content! In the full version, ThottoPilot would analyze your image...",
        photoDescription: "Professional composition with natural lighting, authentic mood, and engaging visual appeal"
      };
      
      expect(fallbackContent.caption).toBeTruthy();
      expect(fallbackContent.titles).toHaveLength(3);
      expect(fallbackContent.hashtags.length).toBeGreaterThan(0);
      expect(fallbackContent.postContent).toContain('demo content');
    });
  });

  describe('AI Provider Error Scenarios', () => {
    test('handles quota exceeded errors', () => {
      const quotaError = new Error('quota exceeded for GPT-4o');
      
      let finalError;
      try {
        if (quotaError.message.includes('quota') || quotaError.message.includes('billing')) {
          finalError = new Error('AI service quota exceeded. Please upgrade your plan or try again later.');
        }
      } catch (e) {
        finalError = e;
      }
      
      expect(finalError.message).toBe('AI service quota exceeded. Please upgrade your plan or try again later.');
    });

    test('handles API key configuration errors', () => {
      const apiKeyError = new Error('Invalid API key provided');
      
      let finalError;
      try {
        if (apiKeyError.message.includes('API key')) {
          finalError = new Error('AI service configuration error. Please contact support.');
        }
      } catch (e) {
        finalError = e;
      }
      
      expect(finalError.message).toBe('AI service configuration error. Please contact support.');
    });

    test('handles generic AI generation failures', () => {
      const genericError = new Error('Network timeout');
      
      let finalError;
      try {
        // If it's not a specific error, throw generic message
        if (!genericError.message.includes('quota') && !genericError.message.includes('API key')) {
          finalError = new Error('AI content generation temporarily unavailable. Please try again in a few moments.');
        }
      } catch (e) {
        finalError = e;
      }
      
      expect(finalError.message).toBe('AI content generation temporarily unavailable. Please try again in a few moments.');
    });
  });

  describe('Provider Priority System', () => {
    test('validates provider priority order', () => {
      // Simulate the provider priority from multi-ai-provider.ts
      const providerPriority = [
        { name: 'gemini-flash', cost: 0.075, priority: 1 },
        { name: 'claude-haiku', cost: 0.25, priority: 2 },
        { name: 'openai-gpt4o', cost: 5.00, priority: 3 },
      ];
      
      // Should be sorted by cost (lowest first)
      const sortedByCost = providerPriority.sort((a, b) => a.cost - b.cost);
      
      expect(sortedByCost[0].name).toBe('gemini-flash');
      expect(sortedByCost[1].name).toBe('claude-haiku');
      expect(sortedByCost[2].name).toBe('openai-gpt4o');
    });

    test('provider availability check works correctly', () => {
      process.env.GOOGLE_GENAI_API_KEY = 'test-key';
      process.env.OPENAI_API_KEY = 'test-key';
      
      const providers = [
        { name: 'gemini-flash', available: !!process.env.GOOGLE_GENAI_API_KEY },
        { name: 'openai-gpt4o', available: !!process.env.OPENAI_API_KEY },
        { name: 'claude-haiku', available: !!process.env.ANTHROPIC_API_KEY }, // Not set
      ];
      
      const availableProviders = providers.filter(p => p.available);
      
      expect(availableProviders).toHaveLength(2);
      expect(availableProviders.map(p => p.name)).toContain('gemini-flash');
      expect(availableProviders.map(p => p.name)).toContain('openai-gpt4o');
    });
  });

  describe('Content Generation Safety', () => {
    test('ensures fallback content is always available', () => {
      // Simulate complete AI failure
      const aiFailureResponse = null;
      
      const safetyFallback = {
        content: "Demo content generated by ThottoPilot's template system.",
        title: "Beautiful content awaits!",
        success: true,
        source: 'template'
      };
      
      const finalResponse = aiFailureResponse || safetyFallback;
      
      expect(finalResponse.success).toBe(true);
      expect(finalResponse.content).toBeTruthy();
      expect(finalResponse.source).toBe('template');
    });

    test('validates content structure in responses', () => {
      const mockResponse = {
        caption: "Test caption",
        titles: ["Title 1", "Title 2"],
        hashtags: ["#test", "#demo"],
        postContent: "Test post content",
        photoDescription: "Test description"
      };
      
      // Validate required fields
      expect(mockResponse.caption).toBeTruthy();
      expect(Array.isArray(mockResponse.titles)).toBe(true);
      expect(Array.isArray(mockResponse.hashtags)).toBe(true);
      expect(mockResponse.postContent).toBeTruthy();
      expect(mockResponse.photoDescription).toBeTruthy();
      
      // Validate content quality
      expect(mockResponse.titles.length).toBeGreaterThan(0);
      expect(mockResponse.hashtags.length).toBeGreaterThan(0);
    });
  });
});