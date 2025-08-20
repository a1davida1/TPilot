import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { visionModel, textModel } from "../lib/gemini";
import { CaptionArray, RankResult, platformChecks } from "./schema";

async function loadPrompt(p: string) {
  return fs.readFile(path.join(process.cwd(), "prompts", p), "utf8");
}

async function fetchAsBase64(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch image failed: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return buf.toString("base64");
}

async function safeJSON<T>(txt: string): Promise<T> {
  const start = txt.indexOf("{"); const arr = txt.indexOf("[");
  const i = (arr !== -1 && (arr < start || start === -1)) ? arr : start;
  const j = Math.max(txt.lastIndexOf("}"), txt.lastIndexOf("]"));
  const core = (i !== -1 && j !== -1) ? txt.slice(i, j+1) : txt;
  return JSON.parse(core);
}

export async function extractFacts(imageUrl: string) {
  const sys = await loadPrompt("system.txt");
  const guard = await loadPrompt("guard.txt");
  const prompt = await loadPrompt("extract.txt");
  const base64 = await fetchAsBase64(imageUrl);
  const res = await visionModel.generateContent([
    { text: sys + "\n" + guard + "\n" + prompt },
    { inlineData: { data: base64, mimeType: "image/jpeg" } }
  ]);
  return safeJSON<any>(res.response.text());
}

export async function generateVariants(params: {platform: "instagram"|"x"|"reddit"|"tiktok", voice: string, facts: any, hint?: string}) {
  const sys = await loadPrompt("system.txt");
  const guard = await loadPrompt("guard.txt");
  const prompt = await loadPrompt("variants.txt");
  const user = `
    PLATFORM: ${params.platform}
    VOICE: ${params.voice}
    IMAGE_FACTS: ${JSON.stringify(params.facts)}
    ${params.hint ? "HINT:"+params.hint : ""}
  `;
  const res = await textModel.generateContent([{ text: sys + "\n" + guard + "\n" + prompt + "\n" + user }]);
  const json = await safeJSON(res.response.text());
  return CaptionArray.parse(json);
}

export async function rankAndSelect(variants: any) {
  const sys = await loadPrompt("system.txt");
  const guard = await loadPrompt("guard.txt");
  const prompt = await loadPrompt("rank.txt");
  const user = JSON.stringify(variants);
  const res = await textModel.generateContent([{ text: sys + "\n" + guard + "\n" + prompt + "\n" + user }]);
  const json = await safeJSON(res.response.text());
  return RankResult.parse(json);
}

export async function pipeline({ imageUrl, platform, voice }: { imageUrl: string, platform: "instagram"|"x"|"reddit"|"tiktok", voice?: string }) {
  const v = voice || "flirty_playful";
  const facts = await extractFacts(imageUrl);
  let variants = await generateVariants({ platform, voice: v, facts });
  let ranked = await rankAndSelect(variants);
  let out = ranked.final;

  // quality gates
  const err = platformChecks(platform, out);
  if (err || out.caption.toLowerCase().includes("generated content")) {
    variants = await generateVariants({ platform, voice: v, facts, hint: `Fix: ${err || "No placeholders"}; ground in objects/colors/setting from IMAGE_FACTS` });
    ranked = await rankAndSelect(variants);
    out = ranked.final;
  }

  return { facts, variants, ranked, final: out };
}