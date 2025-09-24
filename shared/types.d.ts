// Global type definitions

export interface MultiAIResponse {
  provider: string;
  estimatedCost: number;
  platform: string;
  fallbackUsed: boolean;
  id?: string;
  category?: "engagement" | "shower" | "teasing" | "lifestyle" | "promotional" | "announcement";
  titles: string[];
  content: string;
  photoInstructions: {
    lighting: string;
    cameraAngle: string;
    composition: string;
    styling: string;
    mood: string;
    technicalSettings: string;
  };
  hashtags?: string[];
  emoji?: string;
  wordCount?: number;
  generationType?: string;
}

export interface ContentResult {
  success: boolean;
  content?: MultiAIResponse;
  error?: string;
}

export interface RedditPostResult {
  success: boolean;
  postId?: string;
  url?: string;
  error?: string;
}

// Queue job handler type fix
export type QueueJobHandler<T> = (jobData: T, jobId: string) => Promise<void>;