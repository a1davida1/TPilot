import fs from "node:fs/promises";
import path from "node:path";
import { visionModel, textModel } from "../lib/gemini";
import { CaptionArray, RankResult, platformChecks } from "./schema";

async function load(p:string){ return fs.readFile(path.join(process.cwd(),"prompts",p),"utf8"); }
async function b64(url:string){ const r=await fetch(url); if(!r.ok) throw new Error("fetch failed"); const b=Buffer.from(await r.arrayBuffer()); return b.toString("base64"); }
function stripToJSON(txt:string){ const i=Math.min(...[txt.indexOf("{"),txt.indexOf("[")].filter(x=>x>=0));
  const j=Math.max(txt.lastIndexOf("}"),txt.lastIndexOf("]")); return JSON.parse((i>=0&&j>=0)?txt.slice(i,j+1):txt); }

export async function extractFacts(imageUrl:string){
  const sys=await load("system.txt"), guard=await load("guard.txt"), prompt=await load("extract.txt");
  const img={ inlineData:{ data: await b64(imageUrl), mimeType:"image/jpeg" } };
  const res=await visionModel.generateContent([{text:sys+"\n"+guard+"\n"+prompt}, img]);
  return stripToJSON(res.response.text());
}

export async function generateVariants(params:{platform:"instagram"|"x"|"reddit"|"tiktok", voice:string, facts:any, hint?:string}){
  const sys=await load("system.txt"), guard=await load("guard.txt"), prompt=await load("variants.txt");
  const user=`PLATFORM: ${params.platform}\nVOICE: ${params.voice}\nIMAGE_FACTS: ${JSON.stringify(params.facts)}\n${params.hint?`HINT:${params.hint}`:""}`;
  const res=await textModel.generateContent([{ text: sys+"\n"+guard+"\n"+prompt+"\n"+user }]);
  const json=stripToJSON(res.response.text());
  // Fix common safety_level values
  if(Array.isArray(json)){
    json.forEach((item:any)=>{
      if(item.safety_level==="safe") item.safety_level="normal";
      if(!item.mood || item.mood.length<2) item.mood="engaging";
      if(!item.style || item.style.length<2) item.style="authentic";
      if(!item.cta || item.cta.length<2) item.cta="Check it out";
    });
  }
  return CaptionArray.parse(json);
}

export async function rankAndSelect(variants:any){
  const sys=await load("system.txt"), guard=await load("guard.txt"), prompt=await load("rank.txt");
  const res=await textModel.generateContent([{ text: sys+"\n"+guard+"\n"+prompt+"\n"+JSON.stringify(variants) }]);
  const json=stripToJSON(res.response.text());
  // Fix safety_level in final result
  if(json.final && json.final.safety_level==="safe") json.final.safety_level="normal";
  if(json.final && (!json.final.mood || json.final.mood.length<2)) json.final.mood="engaging";
  if(json.final && (!json.final.style || json.final.style.length<2)) json.final.style="authentic";
  if(json.final && (!json.final.cta || json.final.cta.length<2)) json.final.cta="Check it out";
  return RankResult.parse(json);
}

export async function pipeline({ imageUrl, platform, voice="flirty_playful" }:{
  imageUrl:string, platform:"instagram"|"x"|"reddit"|"tiktok", voice?:string }){
  const facts = await extractFacts(imageUrl);
  let variants = await generateVariants({ platform, voice, facts });
  let ranked = await rankAndSelect(variants);
  let out = ranked.final;

  const err = platformChecks(platform, out);
  if (err) {
    variants = await generateVariants({ platform, voice, facts, hint:`Fix: ${err}. Use IMAGE_FACTS nouns/colors/setting explicitly.` });
    ranked = await rankAndSelect(variants);
    out = ranked.final;
  }

  return { facts, variants, ranked, final: out };
}