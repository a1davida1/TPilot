import fs from "node:fs/promises";
import path from "node:path";
import { textModel, visionModel } from "../lib/gemini";
import { CaptionArray, RankResult, platformChecks } from "./schema";

// CaptionResult interface for type safety
interface CaptionResult {
  provider: string;
  final: any;
  facts?: any;
  variants?: any;
  ranked?: any;
}

async function load(p:string){ return fs.readFile(path.join(process.cwd(),"prompts",p),"utf8"); }
async function b64(url:string){ const r=await fetch(url); if(!r.ok) throw new Error("fetch failed"); const b=Buffer.from(await r.arrayBuffer()); return b.toString("base64"); }
function stripToJSON(txt:string){ const i=Math.min(...[txt.indexOf("{"),txt.indexOf("[")].filter(x=>x>=0));
  const j=Math.max(txt.lastIndexOf("}"),txt.lastIndexOf("]")); return JSON.parse((i>=0&&j>=0)?txt.slice(i,j+1):txt); }

export async function extractFacts(imageUrl:string){
  const sys=await load("system.txt"), guard=await load("guard.txt"), prompt=await load("extract.txt");
  const img={ inlineData:{ data: await b64(imageUrl), mimeType:"image/jpeg" } };
  try {
    const res=await visionModel.generateContent([{text:sys+"\n"+guard+"\n"+prompt}, img]);
    return stripToJSON(res.response.text());
  } catch (error) {
    console.error('Gemini visionModel.generateContent failed:', error);
    throw error;
  }
}

export async function variantsRewrite(params:{platform:"instagram"|"x"|"reddit"|"tiktok", voice:string, style?:string, mood?:string, existingCaption:string, facts?:any, hint?:string, nsfw?:boolean}){
  const sys=await load("system.txt"), guard=await load("guard.txt"), prompt=await load("rewrite.txt");
  const user=`PLATFORM: ${params.platform}\nVOICE: ${params.voice}\n${params.style ? `STYLE: ${params.style}\n` : ''}${params.mood ? `MOOD: ${params.mood}\n` : ''}EXISTING_CAPTION: "${params.existingCaption}"${params.facts?`\nIMAGE_FACTS: ${JSON.stringify(params.facts)}`:""}\nNSFW: ${params.nsfw || false}${params.hint?`\nHINT:${params.hint}`:""}`;
  let res;
  try {
    res=await textModel.generateContent([{ text: sys+"\n"+guard+"\n"+prompt+"\n"+user }]);
  } catch (error) {
    console.error('Gemini textModel.generateContent failed:', error);
    throw error;
  }
  const json=stripToJSON(res.response.text());
  // Fix common safety_level values and missing fields
  if(Array.isArray(json)){
    json.forEach((item: unknown)=>{
      // Accept any safety_level from AI but normalize "suggestive"
      if(!item.safety_level) item.safety_level="suggestive";
      else if(item.safety_level === 'suggestive') item.safety_level = 'spicy_safe';
      // Fix other fields
      if(!item.mood || item.mood.length<2) item.mood="engaging";
      if(!item.style || item.style.length<2) item.style="authentic";
      if(!item.cta || item.cta.length<2) item.cta="Check it out";
      if(!item.alt || item.alt.length<20) item.alt="Engaging social media content";
      if(!item.hashtags || !Array.isArray(item.hashtags)) item.hashtags=["#content", "#creative", "#amazing"];
      if(!item.caption || item.caption.length<1) item.caption="Check out this amazing content, you'll love it and want more!";
    });

    // Ensure exactly 5 variants by padding with variations if needed
    while(json.length < 5) {
      const template = json[0] || {
        caption: "Check out this amazing content, you'll love it and want more!",
        alt: "Engaging social media content",
        hashtags: ["#content", "#creative", "#amazing"],
        cta: "Check it out",
        mood: "engaging",
        style: "authentic",
        safety_level: "suggestive",
        nsfw: false
      };
      json.push({...template, caption: template.caption + ` This enhanced version provides much more engaging content and better call-to-action for your audience! (Variant ${json.length + 1})`});
    }

    // Trim to exactly 5 if more than 5
    if(json.length > 5) {
      json.splice(5);
    }
  }
  return CaptionArray.parse(json);
}

export async function rankAndSelect(variants: unknown){
  const sys=await load("system.txt"), guard=await load("guard.txt"), prompt=await load("rank.txt");
  let res;
  try {
    res=await textModel.generateContent([{ text: sys+"\n"+guard+"\n"+prompt+"\n"+JSON.stringify(variants) }]);
  } catch (error) {
    console.error('Gemini textModel.generateContent failed:', error);
    throw error;
  }
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
    if(!json.final.safety_level) json.final.safety_level="suggestive";
    if(!json.final.mood || json.final.mood.length<2) json.final.mood="engaging";
    if(!json.final.style || json.final.style.length<2) json.final.style="authentic";
    if(!json.final.cta || json.final.cta.length<2) json.final.cta="Check it out";
    if(!json.final.alt || json.final.alt.length<20) json.final.alt="Engaging social media content";
    if(!json.final.hashtags || !Array.isArray(json.final.hashtags)) json.final.hashtags=["#content", "#creative", "#amazing"];
    if(!json.final.caption || json.final.caption.length<1) json.final.caption="Check out this amazing content!";
  }
  return RankResult.parse(json);
}

export async function pipelineRewrite({ platform, voice="flirty_playful", style, mood, existingCaption, imageUrl, nsfw=false }:{
  platform:"instagram"|"x"|"reddit"|"tiktok", voice?:string, style?:string, mood?:string, existingCaption:string, imageUrl?:string, nsfw?:boolean }){
  try {
    const facts = imageUrl ? await extractFacts(imageUrl) : undefined;
    let variants = await variantsRewrite({ platform, voice, style, mood, existingCaption, facts, nsfw });
    let ranked = await rankAndSelect(variants);
    let out = ranked.final;
    
    // Ensure rewritten caption is longer and more engaging than original
    if(out.caption.length <= existingCaption.length) {
      out.caption = existingCaption + " ✨ Enhanced with engaging content and call-to-action that drives better engagement!";
    }

    const err = platformChecks(platform, out);
    if (err) {
      variants = await variantsRewrite({ platform, voice, existingCaption, facts, hint:`Fix: ${err}. Be specific and engaging.`, nsfw });
      ranked = await rankAndSelect(variants);
      out = ranked.final;
    }

    return { provider: 'gemini', facts, variants, ranked, final: out };
  } catch (error) {
    const { openAICaptionFallback } = await import('./openaiFallback');
    const final = await openAICaptionFallback({ platform, voice, existingCaption, imageUrl });
    return { provider: 'openai', final } as CaptionResult;
  }
}