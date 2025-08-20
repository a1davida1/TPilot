import { z } from "zod";

export const CaptionItem = z.object({
  caption: z.string().min(1),
  alt: z.string().min(20).max(200),
  hashtags: z.array(z.string()).min(2).max(10),
  cta: z.string().min(2),
  mood: z.string().min(2),
  style: z.string().min(2),
  safety_level: z.enum(["normal","spicy_safe","needs_review"])
});

export const CaptionArray = z.array(CaptionItem).length(5);

export const RankResult = z.object({
  winner_index: z.number().min(0).max(4),
  scores: z.array(z.number()).length(5),
  reason: z.string().min(1).max(240),
  final: CaptionItem
});

export function platformChecks(p: "instagram"|"x"|"reddit"|"tiktok", item: z.infer<typeof CaptionItem>) {
  const len = item.caption.length;
  if (p === "x" && len > 250) return "X caption too long";
  if (p === "tiktok" && (len < 150 || len > 220)) return "TikTok length out of range (150–220)";
  if (p === "instagram" && len > 2200) return "Instagram caption too long";
  if (p === "reddit" && item.hashtags.some(h=>h.startsWith("#"))) return "Reddit: no hashtag spam";
  // basic hashtag ranges
  const count = item.hashtags.length;
  if (p === "instagram" && (count < 3 || count > 8)) return "Instagram hashtags 3–8";
  if (p === "x" && (count < 0 || count > 3)) return "X hashtags 0–3";
  if (p === "tiktok" && (count < 2 || count > 5)) return "TikTok hashtags 2–5";
  // ban basic generic tags
  const banned = new Set(["#love","#follow","#like","#instagood","#photooftheday"]);
  if (item.hashtags.some(h=>banned.has(h.toLowerCase()))) return "Generic hashtags detected";
  return null;
}