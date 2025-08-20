import fs from "node:fs/promises";
import path from "node:path";
import { textModel } from "../lib/gemini";
import { CaptionArray, RankResult, platformChecks } from "./schema";

async function load(p:string){ return fs.readFile(path.join(process.cwd(),"prompts",p),"utf8"); }
function stripToJSON(txt:string){ const i=Math.min(...[txt.indexOf("{"),txt.indexOf("[")].filter(x=>x>=0));
  const j=Math.max(txt.lastIndexOf("}"),txt.lastIndexOf("]")); return JSON.parse((i>=0&&j>=0)?txt.slice(i,j+1):txt); }

export async function generateVariantsTextOnly(params:{platform:"instagram"|"x"|"reddit"|"tiktok", voice:string, theme:string, context?:string, hint?:string}){
  const sys=await load("system.txt"), guard=await load("guard.txt"), prompt=await load("variants_textonly.txt");
  const user=`PLATFORM: ${params.platform}\nVOICE: ${params.voice}\nTHEME: "${params.theme}"\nCONTEXT: "${params.context||''}"${params.hint?`\nHINT:${params.hint}`:""}`;
  const res=await textModel.generateContent([{ text: sys+"\n"+guard+"\n"+prompt+"\n"+user }]);
  const json=stripToJSON(res.response.text());
  // Fix common safety_level values and missing fields
  if(Array.isArray(json)){
    json.forEach((item:any)=>{
      // Fix safety_level variations
      if(!item.safety_level || item.safety_level==="safe" || item.safety_level==="1" || item.safety_level===1) item.safety_level="normal";
      else if(item.safety_level==="2" || item.safety_level===2) item.safety_level="spicy_safe";
      else if(item.safety_level==="3" || item.safety_level===3) item.safety_level="needs_review";
      // Fix other fields
      if(!item.mood || item.mood.length<2) item.mood="engaging";
      if(!item.style || item.style.length<2) item.style="authentic";
      if(!item.cta || item.cta.length<2) item.cta="Check it out";
      if(!item.alt || item.alt.length<20) item.alt="Engaging social media content";
      if(!item.hashtags || !Array.isArray(item.hashtags)) item.hashtags=["#content"];
      if(!item.caption || item.caption.length<1) item.caption="Check out this amazing content!";
    });
  }
  return CaptionArray.parse(json);
}

export async function rankAndSelect(variants:any){
  const sys=await load("system.txt"), guard=await load("guard.txt"), prompt=await load("rank.txt");
  const res=await textModel.generateContent([{ text: sys+"\n"+guard+"\n"+prompt+"\n"+JSON.stringify(variants) }]);
  const json=stripToJSON(res.response.text());
  // Fix safety_level in final result
  if(json.final){
    if(!json.final.safety_level || json.final.safety_level==="safe" || json.final.safety_level==="1" || json.final.safety_level===1) json.final.safety_level="normal";
    else if(json.final.safety_level==="2" || json.final.safety_level===2) json.final.safety_level="spicy_safe";
    else if(json.final.safety_level==="3" || json.final.safety_level===3) json.final.safety_level="needs_review";
    if(!json.final.mood || json.final.mood.length<2) json.final.mood="engaging";
    if(!json.final.style || json.final.style.length<2) json.final.style="authentic";
    if(!json.final.cta || json.final.cta.length<2) json.final.cta="Check it out";
    if(!json.final.alt || json.final.alt.length<20) json.final.alt="Engaging social media content";
    if(!json.final.hashtags || !Array.isArray(json.final.hashtags)) json.final.hashtags=["#content"];
    if(!json.final.caption || json.final.caption.length<1) json.final.caption="Check out this amazing content!";
  }
  return RankResult.parse(json);
}

export async function pipelineTextOnly({ platform, voice="flirty_playful", theme, context }:{
  platform:"instagram"|"x"|"reddit"|"tiktok", voice?:string, theme:string, context?:string }){
  let variants = await generateVariantsTextOnly({ platform, voice, theme, context });
  let ranked = await rankAndSelect(variants);
  let out = ranked.final;

  const err = platformChecks(platform, out);
  if (err) {
    variants = await generateVariantsTextOnly({ platform, voice, theme, context, hint:`Fix: ${err}. Be specific and engaging.` });
    ranked = await rankAndSelect(variants);
    out = ranked.final;
  }

  return { variants, ranked, final: out };
}