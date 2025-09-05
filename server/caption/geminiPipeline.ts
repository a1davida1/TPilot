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
      // Extract base64 data from data URL - use indexOf to find first comma only
      const commaIndex = imageUrl.indexOf(',');
      if (commaIndex === -1) {
        throw new Error('Invalid data URL format - missing comma separator');
      }
      
      const header = imageUrl.substring(0, commaIndex);
      imageData = imageUrl.substring(commaIndex + 1);
      
      // Extract mime type from header
      const mimeMatch = header.match(/data:([^;]+)/);
      if (mimeMatch) {
        mimeType = mimeMatch[1];
      }
      
      // Base64 data from data URLs should be used as-is
      // Note: decodeURIComponent can corrupt valid base64 strings
      
      // Validate and clean Base64 data
      imageData = imageData.replace(/\s/g, ''); // Remove any whitespace
      
      // Re-encode to ensure proper Base64 formatting and padding
      imageData = Buffer.from(imageData, 'base64').toString('base64');
      imageData += '='.repeat((4 - imageData.length % 4) % 4); // ensure padding
      
      // Test Base64 validity by attempting to decode it
      let decodedBuffer;
      try {
        decodedBuffer = Buffer.from(imageData, 'base64');
      } catch (base64Error) {
        console.error('Base64 validation failed:', base64Error);
        throw new Error(`Invalid Base64 data format: ${base64Error instanceof Error ? base64Error.message : String(base64Error)}`);
      }
      
      // Additional validation for WebP format
      if (mimeType === 'image/webp') {
        console.log('WebP format detected, validating header...');
        const headerSignature = decodedBuffer.subarray(0, 4).toString();
        if (headerSignature !== 'RIFF') {
          console.warn('WebP validation warning: Missing RIFF header');
        }
      }
      
      // Check if Base64 data is reasonable length (not too short or extremely long)
      if (imageData.length < 100) {
        throw new Error('Base64 data appears to be too short');
      }
      
      if (imageData.length > 10000000) { // ~7.5MB base64 encoded
        throw new Error('Image data too large for processing');
      }
      
      console.log(`Processing data URL with mime type: ${mimeType}, data length: ${imageData.length}`);
      console.log(`Base64 starts with: ${imageData.substring(0, 50)}...`);
    } else {
      console.log('Fetching image from URL:', imageUrl);
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
  // Fix common safety_level values and missing fields
  if(Array.isArray(json)){
    json.forEach((item:any)=>{
      // Accept any safety_level from AI
      if(!item.safety_level) item.safety_level="normal";
      // Fix other fields
      if(!item.mood || item.mood.length<2) item.mood="engaging";
      if(!item.style || item.style.length<2) item.style="authentic";
      if(!item.cta || item.cta.length<2) item.cta="Check it out";
      if(!item.alt || item.alt.length<20) item.alt="Engaging social media content";
      if(!item.hashtags || !Array.isArray(item.hashtags)) item.hashtags=["#content", "#creative", "#amazing"];
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

export async function rankAndSelect(variants:any){
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
  
  // Accept any safety_level in final result  
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