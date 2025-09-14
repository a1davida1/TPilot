import { vi } from "vitest";

// Global mocks
global.mockGemini = vi.fn();
global.mockOpenAI = vi.fn();
global.mockClaude = vi.fn();

vi.mock("../server/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
  }
}));