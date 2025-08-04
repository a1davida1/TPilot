export interface ContentStyle {
  id: string;
  name: string;
  description: string;
}

export interface ContentTheme {
  id: string;
  name: string;
  description: string;
}

export const CONTENT_STYLES: ContentStyle[] = [
  { id: "playful", name: "Playful", description: "Fun and engaging tone" },
  { id: "mysterious", name: "Mysterious", description: "Intriguing and alluring" },
  { id: "bold", name: "Bold", description: "Confident and assertive" },
  { id: "elegant", name: "Elegant", description: "Sophisticated and refined" },
];

export const CONTENT_THEMES: ContentTheme[] = [
  { id: "lifestyle", name: "Lifestyle", description: "Everyday moments and authenticity" },
  { id: "fashion", name: "Fashion", description: "Style-focused content" },
  { id: "artistic", name: "Artistic", description: "Creative and expressive" },
];

export const PLATFORMS = [
  { id: "reddit", name: "Reddit" },
  { id: "twitter", name: "Twitter" },
  { id: "instagram", name: "Instagram" },
];
