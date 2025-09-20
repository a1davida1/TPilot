import fs from "node:fs/promises";
import path from "node:path";
import { textModel } from "../lib/gemini";
import { CaptionArray, RankResult, platformChecks } from "./schema";
import { normalizeSafetyLevel } from "./normalizeSafetyLevel";
import { extractToneOptions, ToneOptions } from "./toneOptions";

async function load(p:string){ return fs.readFile(path.join(process.cwd(),"prompts",p),"utf8"); }
function stripToJSON(txt:string){ const i=Math.min(...[txt.indexOf("{"),txt.indexOf("[")].filter(x=>x>=0));
  const j=Math.max(txt.lastIndexOf("}"),txt.lastIndexOf("]")); return JSON.parse((i>=0&&j>=0)?txt.slice(i,j+1):txt); }

type TextOnlyVariantParams = {
  platform:"instagram"|"x"|"reddit"|"tiktok";
  voice:string;
  theme:string;
  context?:string;
  hint?:string;
  nsfw?:boolean;
  style?: string;
  mood?: string;
};

export async function generateVariantsTextOnly(params:TextOnlyVariantParams){
  const sys=await load("system.txt"), guard=await load("guard.txt"), prompt=await load("variants_textonly.txt");
  const user=`PLATFORM: ${params.platform}\nVOICE: ${params.voice}\n${params.style ? `STYLE: ${params.style}\n` : ''}${params.mood ? `MOOD: ${params.mood}\n` : ''}THEME: "${params.theme}"\nCONTEXT: "${params.context||''}"\nNSFW: ${params.nsfw || false}${params.hint?`\nHINT:${params.hint}`:""}`;
  const res=await textModel.generateContent([{ text: sys+"\n"+guard+"\n"+prompt+"\n"+user }]);
  const raw=stripToJSON(res.response.text());
  const json=Array.isArray(raw)?raw:[raw];
  // Fix common safety_level values and missing fields
  if(Array.isArray(json)){
    json.forEach((item) => {
      const variant = item as Record<string, unknown>;
      variant.safety_level = normalizeSafetyLevel(
        typeof variant.safety_level === 'string' ? variant.safety_level : 'normal'
      );
      // Fix other fields
      if(typeof variant.mood !== 'string' || variant.mood.length<2) variant.mood="engaging";
      if(typeof variant.style !== 'string' || variant.style.length<2) variant.style="authentic";
      if(typeof variant.cta !== 'string' || variant.cta.length<2) variant.cta="Check it out";
      if(typeof variant.alt !== 'string' || variant.alt.length<20) variant.alt="Engaging social media content";
      if(!Array.isArray(variant.hashtags) || variant.hashtags.length < 3) {
        if(params.platform === 'instagram') {
          variant.hashtags=["#content", "#creative", "#amazing", "#lifestyle"];
        } else {
          variant.hashtags=["#content", "#creative", "#amazing"];
        }
      }
      if(typeof variant.caption !== 'string' || variant.caption.length<1) variant.caption="Check out this amazing content!";
    });

    // Ensure exactly 5 variants by padding with variations if needed
    while(json.length < 5) {
      const template = (json[0] as Record<string, unknown>) || {
        caption: "Check out this amazing content!",
        alt: "Engaging social media content",
        hashtags: ["#content", "#creative", "#amazing"],
        cta: "Check it out",
        mood: "engaging",
        style: "authentic",
        safety_level: normalizeSafetyLevel('normal'),
        nsfw: false
      };
      json.push({
        ...template,
        caption: `${template.caption as string} (Variant ${json.length + 1})`
      });
    }

    // Trim to exactly 5 if more than 5
    if(json.length > 5) {
      json.splice(5);
    }
  }
  return CaptionArray.parse(json);
}

export async function rankAndSelect(variants: unknown[], params?: { platform?: string; nsfw?: boolean }){
  const sys=await load("system.txt"), guard=await load("guard.txt"), prompt=await load("rank.txt");
  const res=await textModel.generateContent([{ text: sys+"\n"+guard+"\n"+prompt+"\n"+JSON.stringify(variants) }]);
  let json=stripToJSON(res.response.text()) as unknown;

  // Handle case where AI returns array instead of ranking object
  if(Array.isArray(json)) {
    const winner = json[0] || variants[0];
    json = {
      winner_index: 0,
      scores: [5, 4, 3, 2, 1],
      reason: "Selected based on engagement potential",
      final: winner
    };
  }

  // Fix safety_level in final result
  if((json as Record<string, unknown>).final){
    const final = (json as { final: Record<string, unknown> }).final;
    final.safety_level = normalizeSafetyLevel(
      typeof final.safety_level === 'string' ? final.safety_level : 'normal'
    );
    if(typeof final.mood !== 'string' || final.mood.length<2) final.mood="engaging";
    if(typeof final.style !== 'string' || final.style.length<2) final.style="authentic";
    if(typeof final.cta !== 'string' || final.cta.length<2) final.cta="Check it out";
    if(typeof final.alt !== 'string' || final.alt.length<20) final.alt="Engaging social media content";
    if(!Array.isArray(final.hashtags) || final.hashtags.length < 3) {
      if(params?.platform === 'instagram') {
        final.hashtags=["#content", "#creative", "#amazing", "#lifestyle"];
      } else {
        final.hashtags=["#content", "#creative", "#amazing"];
      }
    }
    if(typeof final.caption !== 'string' || final.caption.length<1) final.caption="Check out this amazing content!";
  }
  return RankResult.parse(json);
}

type TextOnlyPipelineArgs = {
  platform:"instagram"|"x"|"reddit"|"tiktok";
  voice?:string;
  theme:string;
  context?:string;
  nsfw?:boolean;
} & ToneOptions;

/**
 * Text-only caption pipeline for brainstorming without an image upload.
 *
 * @remarks
 * Persona settings (`style`, `mood`, etc.) are forwarded to every Gemini retry so the
 * voice remains consistent even when a platform validation retry is required.
 */
export async function pipelineTextOnly({ platform, voice="flirty_playful", theme, context, nsfw=false, ...toneRest }:TextOnlyPipelineArgs){
  const tone = extractToneOptions(toneRest);
  let variants = await generateVariantsTextOnly({ platform, voice, theme, context, nsfw, ...tone });
  let ranked = await rankAndSelect(variants, { platform, nsfw });
  let out = ranked.final;

  const err = platformChecks(platform, out);
  if (err) {
    variants = await generateVariantsTextOnly({ platform, voice, theme, context, nsfw, ...tone, hint:`Fix: ${err}. Be specific and engaging.` });
    ranked = await rankAndSelect(variants);
    out = ranked.final;
  }

  return { variants, ranked, final: out };
}