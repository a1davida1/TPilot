// Gemini AI model stubs for testing

export const textModel = {
  generateContent: async (prompt) => {
    // Mock implementation for testing
    return {
      response: {
        text: () => JSON.stringify({
          variants: [
            { title: "Mock Title 1", caption: "Mock caption 1", hashtags: ["mock1", "test1"] },
            { title: "Mock Title 2", caption: "Mock caption 2", hashtags: ["mock2", "test2"] },
            { title: "Mock Title 3", caption: "Mock caption 3", hashtags: ["mock3", "test3"] },
            { title: "Mock Title 4", caption: "Mock caption 4", hashtags: ["mock4", "test4"] },
            { title: "Mock Title 5", caption: "Mock caption 5", hashtags: ["mock5", "test5"] }
          ]
        })
      }
    };
  }
};

export const visionModel = {
  generateContent: async (prompt, image) => {
    // Mock implementation for testing
    return {
      response: {
        text: () => JSON.stringify({
          variants: [
            { title: "Vision Mock Title 1", caption: "Vision mock caption 1", hashtags: ["vision1", "test1"] },
            { title: "Vision Mock Title 2", caption: "Vision mock caption 2", hashtags: ["vision2", "test2"] },
            { title: "Vision Mock Title 3", caption: "Vision mock caption 3", hashtags: ["vision3", "test3"] },
            { title: "Vision Mock Title 4", caption: "Vision mock caption 4", hashtags: ["vision4", "test4"] },
            { title: "Vision Mock Title 5", caption: "Vision mock caption 5", hashtags: ["vision5", "test5"] }
          ]
        })
      }
    };
  }
};

export default { textModel, visionModel };