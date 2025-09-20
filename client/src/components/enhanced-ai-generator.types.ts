
export interface GeneratedContent {
  titles: string[];
  content: string;
  contentSource?: string;
  aiProvider?: string;
  upgradeMessage?: string;
  photoInstructions?: string | object;
}

export interface GenerateContentVariables {
  platform?: string;
  customPrompt?: string;
  subreddit?: string;
  allowsPromotion?: "none" | "subtle" | "moderate" | "full";
  photoType?: string;
  textTone?: string;
  includeHashtags?: boolean;
  selectedHashtags?: string[];
  preferredProvider?: string;
  includePromotion?: boolean;
  style?: string;
  theme?: string;
  prompt?: string;
}
