#!/usr/bin/env tsx
import { generateVision } from "../server/lib/openrouter-client.js";

// Tiny 1x1 red pixel PNG
const url = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==";

console.log("[Smoke Test] Testing OpenRouter vision with InternVL...");

generateVision({ 
  prompt: "Say 'ok' if you can see an image", 
  imageUrl: url 
})
  .then((text) => { 
    console.log("[Smoke Test] ✅ SUCCESS:", text.slice(0, 120)); 
    process.exit(0); 
  })
  .catch((error) => { 
    console.error("[Smoke Test] ❌ ERROR:", error?.message || error); 
    process.exit(1); 
  });
