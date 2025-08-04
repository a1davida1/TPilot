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
  { id: "tease", name: "Tease", description: "Playful revealing sequence" },
  { id: "shower", name: "Shower", description: "Fresh and clean towel drops" },
  { id: "lingerie", name: "Lingerie", description: "Sexy bedroom vibes" },
];

export const PLATFORMS = [
  { id: "reddit", name: "Reddit" },
  { id: "twitter", name: "Twitter" },
  { id: "instagram", name: "Instagram" },
];
