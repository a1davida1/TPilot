import { z } from "zod";

export const CaptionItem = z.object({
  caption: z.string().min(1),
  alt: z.string().min(20).max(200),
  hashtags: z.array(z.string()).min(1).max(10),
  cta: z.string().min(2),
  mood: z.string().min(2),
  style: z.string().min(2),
  safety_level: z.string(),
  nsfw: z.boolean().default(false)
});
export const CaptionArray = z.array(CaptionItem).length(5);
export const RankResult = z.object({
  winner_index: z.number().min(0).max(4),
  scores: z.array(z.number()).length(5),
  reason: z.string().min(1).max(240),
  final: CaptionItem
});

export function platformChecks(p: "instagram"|"x"|"reddit"|"tiktok", item: z.infer<typeof CaptionItem>) {
  const len = item.caption.length, tags = item.hashtags.length;
  if (p==="x" && len>250) return "X caption too long";
  if (p==="tiktok" && (len<150 || len>220)) return "TikTok length 150–220";
  if (p==="instagram" && len>2200) return "Instagram too long";
  if (p==="reddit" && item.hashtags.some(h=>h.startsWith("#"))) return "Reddit no hashtag spam";
  if (p==="instagram" && (tags<3 || tags>8)) return "IG hashtags 3–8";
  if (p==="x" && tags>3) return "X hashtags 0–3";
  if (p==="tiktok" && (tags<2 || tags>5)) return "TikTok hashtags 2–5";
  const banned = new Set(["#love","#follow","#like","#instagood"]);
  if (item.hashtags.some(h=>banned.has(h.toLowerCase()))) return "Generic hashtags banned";
  if (item.caption.toLowerCase().includes("generated content")) return "Placeholder text";
  return null;
}