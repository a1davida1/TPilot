import fs from "node:fs/promises";
import path from "node:path";
import { visionModel, textModel } from "../lib/gemini";
import { CaptionArray, RankResult, platformChecks } from "./schema";

async function load(p:string){ return fs.readFile(path.join(process.cwd(),"prompts",p),"utf8"); }
async function b64(url:string){ 
  try {
    const r=await fetch(url); 
    if(!r.ok) throw new Error(`fetch failed: ${r.status} ${r.statusText}`); 
    const b=Buffer.from(await r.arrayBuffer()); 
    return b.toString("base64"); 
  } catch (error) {
    console.error('Error fetching image:', error);
    throw new Error(`Failed to fetch image: ${error instanceof Error ? error.message : String(error)}`);
  }
}
function stripToJSON(txt:string){ const i=Math.min(...[txt.indexOf("{"),txt.indexOf("[")].filter(x=>x>=0));
  const j=Math.max(txt.lastIndexOf("}"),txt.lastIndexOf("]")); return JSON.parse((i>=0&&j>=0)?txt.slice(i,j+1):txt); }

export async function extractFacts(imageUrl:string){
  try {
    console.log('Starting fact extraction for image:', imageUrl.substring(0, 100) + '...');
    const sys=await load("system.txt"), guard=await load("guard.txt"), prompt=await load("extract.txt");
    
    // Handle data URLs differently from regular URLs
    let imageData: string;
    let mimeType = "image/jpeg";
    
    if (imageUrl.startsWith('data:')) {
      // Extract base64 data from data URL
      const [header, data] = imageUrl.split(',');
      imageData = data;
      const mimeMatch = header.match(/data:([^;]+)/);
      if (mimeMatch) mimeType = mimeMatch[1];
    } else {
      imageData = await b64(imageUrl);
    }
    
    const img={ inlineData:{ data: imageData, mimeType } };
    console.log('Sending to Gemini for fact extraction...');
    const res=await visionModel.generateContent([{text:sys+"\n"+guard+"\n"+prompt}, img]);
    const result = stripToJSON(res.response.text());
    console.log('Fact extraction completed successfully');
    return result;
  } catch (error) {
    console.error('Error in extractFacts:', error);
    throw new Error(`Failed to extract facts: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function generateVariants(params:{platform:"instagram"|"x"|"reddit"|"tiktok", voice:string, style?:string, mood?:string, facts:any, hint?:string, nsfw?:boolean}){
  const sys=await load("system.txt"), guard=await load("guard.txt"), prompt=await load("variants.txt");
  const user=`PLATFORM: ${params.platform}\nVOICE: ${params.voice}\n${params.style ? `STYLE: ${params.style}\n` : ''}${params.mood ? `MOOD: ${params.mood}\n` : ''}IMAGE_FACTS: ${JSON.stringify(params.facts)}\nNSFW: ${params.nsfw || false}\n${params.hint?`HINT:${params.hint}`:""}`;
  const res=await textModel.generateContent([{ text: sys+"\n"+guard+"\n"+prompt+"\n"+user }]);
  const json=stripToJSON(res.response.text());
  // Fix common safety_level values
  if(Array.isArray(json)){
    json.forEach((item:any)=>{
      // Fix safety_level variations
      if(!item.safety_level || item.safety_level==="safe" || item.safety_level==="1" || item.safety_level===1) item.safety_level="normal";
      else if(item.safety_level==="2" || item.safety_level===2 || item.safety_level==="suggestive") item.safety_level="spicy_safe";
      else if(item.safety_level==="3" || item.safety_level===3 || item.safety_level==="high" || item.safety_level==="nsfw") item.safety_level="needs_review";
      // Fix other fields
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
  if(json.final){
    if(!json.final.safety_level || json.final.safety_level==="safe" || json.final.safety_level==="1" || json.final.safety_level===1) json.final.safety_level="normal";
    else if(json.final.safety_level==="2" || json.final.safety_level===2 || json.final.safety_level==="suggestive") json.final.safety_level="spicy_safe";
    else if(json.final.safety_level==="3" || json.final.safety_level===3 || json.final.safety_level==="high" || json.final.safety_level==="nsfw") json.final.safety_level="needs_review";
    if(!json.final.mood || json.final.mood.length<2) json.final.mood="engaging";
    if(!json.final.style || json.final.style.length<2) json.final.style="authentic";
    if(!json.final.cta || json.final.cta.length<2) json.final.cta="Check it out";
  }
  return RankResult.parse(json);
}

export async function pipeline({ imageUrl, platform, voice="flirty_playful", style, mood, nsfw=false }:{
  imageUrl:string, platform:"instagram"|"x"|"reddit"|"tiktok", voice?:string, style?:string, mood?:string, nsfw?:boolean }){
  const facts = await extractFacts(imageUrl);
  let variants = await generateVariants({ platform, voice, style, mood, facts, nsfw });
  let ranked = await rankAndSelect(variants);
  let out = ranked.final;

  const err = platformChecks(platform, out);
  if (err) {
    variants = await generateVariants({ platform, voice, facts, hint:`Fix: ${err}. Use IMAGE_FACTS nouns/colors/setting explicitly.`, nsfw });
    ranked = await rankAndSelect(variants);
    out = ranked.final;
  }

  return { facts, variants, ranked, final: out };
}