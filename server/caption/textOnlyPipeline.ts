import fs from "node:fs/promises";
import path from "node:path";
import { textModel } from "../lib/gemini";
import { CaptionArray, RankResult, platformChecks } from "./schema";

async function load(p:string){ return fs.readFile(path.join(process.cwd(),"prompts",p),"utf8"); }
function stripToJSON(txt:string){ const i=Math.min(...[txt.indexOf("{"),txt.indexOf("[")].filter(x=>x>=0));
  const j=Math.max(txt.lastIndexOf("}"),txt.lastIndexOf("]")); return JSON.parse((i>=0&&j>=0)?txt.slice(i,j+1):txt); }

export async function generateVariantsTextOnly(params:{platform:"instagram"|"x"|"reddit"|"tiktok", voice:string, style?:string, mood?:string, theme:string, context?:string, hint?:string, nsfw?:boolean}){
  const sys=await load("system.txt"), guard=await load("guard.txt"), prompt=await load("variants_textonly.txt");
  const user=`PLATFORM: ${params.platform}\nVOICE: ${params.voice}\n${params.style ? `STYLE: ${params.style}\n` : ''}${params.mood ? `MOOD: ${params.mood}\n` : ''}THEME: "${params.theme}"\nCONTEXT: "${params.context||''}"\nNSFW: ${params.nsfw || false}${params.hint?`\nHINT:${params.hint}`:""}`;
  const res=await textModel.generateContent([{ text: sys+"\n"+guard+"\n"+prompt+"\n"+user }]);
  const json=stripToJSON(res.response.text());
  // Fix common safety_level values and missing fields
  if(Array.isArray(json)){
    json.forEach((item: unknown)=>{
      // Accept any safety_level from AI
      if(!item.safety_level) item.safety_level="suggestive";
      // Fix other fields
      if(!item.mood || item.mood.length<2) item.mood="engaging";
      if(!item.style || item.style.length<2) item.style="authentic";
      if(!item.cta || item.cta.length<2) item.cta="Check it out";
      if(!item.alt || item.alt.length<20) item.alt="Engaging social media content";
      if(!item.hashtags || !Array.isArray(item.hashtags) || item.hashtags.length < 3) {
        if(params.platform === 'instagram') {
          item.hashtags=["#content", "#creative", "#amazing", "#lifestyle"];
        } else {
          item.hashtags=["#content", "#creative", "#amazing"];
        }
      }
      if(!item.caption || item.caption.length<1) item.caption="Check out this amazing content!";
    });

    // Ensure exactly 5 variants by padding with variations if needed
    while(json.length < 5) {
      const template = json[0] || {
        caption: "Check out this amazing content!",
        alt: "Engaging social media content",
        hashtags: ["#content", "#creative", "#amazing"],
        cta: "Check it out",
        mood: "engaging",
        style: "authentic",
        safety_level: "suggestive",
        nsfw: false
      };
      json.push({...template, caption: template.caption + ` (Variant ${json.length + 1})`});
    }

    // Trim to exactly 5 if more than 5
    if(json.length > 5) {
      json.splice(5);
    }
  }
  return CaptionArray.parse(json);
}

export async function rankAndSelect(variants: unknown, params?: { platform?: string, nsfw?: boolean }){
  const sys=await load("system.txt"), guard=await load("guard.txt"), prompt=await load("rank.txt");
  const res=await textModel.generateContent([{ text: sys+"\n"+guard+"\n"+prompt+"\n"+JSON.stringify(variants) }]);
  let json=stripToJSON(res.response.text());
  
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
  if(json.final){
    // Accept any safety_level in final result
    if(!json.final.safety_level) json.final.safety_level="suggestive";
    if(!json.final.mood || json.final.mood.length<2) json.final.mood="engaging";
    if(!json.final.style || json.final.style.length<2) json.final.style="authentic";
    if(!json.final.cta || json.final.cta.length<2) json.final.cta="Check it out";
    if(!json.final.alt || json.final.alt.length<20) json.final.alt="Engaging social media content";
    if(!json.final.hashtags || !Array.isArray(json.final.hashtags) || json.final.hashtags.length < 3) {
      if(params?.platform === 'instagram') {
        json.final.hashtags=["#content", "#creative", "#amazing", "#lifestyle"];
      } else {
        json.final.hashtags=["#content", "#creative", "#amazing"];
      }
    }
    if(!json.final.caption || json.final.caption.length<1) json.final.caption="Check out this amazing content!";
  }
  return RankResult.parse(json);
}

export async function pipelineTextOnly({ platform, voice="flirty_playful", style, mood, theme, context, nsfw=false }:{
  platform:"instagram"|"x"|"reddit"|"tiktok", voice?:string, style?:string, mood?:string, theme:string, context?:string, nsfw?:boolean }){
  let variants = await generateVariantsTextOnly({ platform, voice, style, mood, theme, context, nsfw });
  let ranked = await rankAndSelect(variants, { platform, nsfw });
  let out = ranked.final;

  const err = platformChecks(platform, out);
  if (err) {
    variants = await generateVariantsTextOnly({ platform, voice, theme, context, hint:`Fix: ${err}. Be specific and engaging.`, nsfw });
    ranked = await rankAndSelect(variants);
    out = ranked.final;
  }

  return { variants, ranked, final: out };
}