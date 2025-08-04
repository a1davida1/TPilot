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
  { id: "shy", name: "Shy", description: "Sweet and nervous" },
  { id: "naughty", name: "Naughty", description: "Horny and direct" },
  { id: "kinky", name: "Kinky", description: "BDSM and rough play" },
];

export const CONTENT_THEMES: ContentTheme[] = [
  { id: "tease", name: "Tease", description: "Playful revealing sequence" },
  { id: "shower", name: "Shower", description: "Fresh and clean towel drops" },
  { id: "lingerie", name: "Lingerie", description: "Sexy bedroom vibes" },
  { id: "slutty", name: "Slutty", description: "Explicit and direct poses" },
  { id: "nude", name: "Nude", description: "Full nudity, no hiding" },
];

export const PLATFORMS = [
  { id: "reddit", name: "Reddit" },
  { id: "twitter", name: "Twitter" },
  { id: "instagram", name: "Instagram" },
];
