import OpenAI from 'openai';
import * as fs from 'fs';
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
export async function generateImageCaption(request) {
    const { imageUrl, imageBase64, platform, contentStyle, includePromotion, customInstructions } = request;
    // Build the prompt based on style and platform
    const stylePrompts = {
        playful: "Create fun, engaging content with a playful and flirty tone",
        mysterious: "Create intriguing, alluring content that leaves viewers wanting more",
        bold: "Create confident, assertive content that commands attention",
        elegant: "Create sophisticated, refined content with class and elegance",
        shy: "Create sweet, slightly nervous content with genuine charm",
        naughty: "Create direct, sultry content with clear intentions",
        kinky: "Create edgy content that hints at adventure and exploration"
    };
    const platformGuidelines = {
        reddit: "Reddit-style authentic and engaging posts that feel genuine and relatable",
        twitter: "Twitter-style concise but impactful posts with trending appeal",
        instagram: "Instagram-style visually focused content with lifestyle appeal"
    };
    const promotionText = includePromotion
        ? "Include subtle promotional elements that feel natural and not pushy"
        : "Keep content authentic without promotional elements";
    const prompt = `
Analyze this image and create engaging social media content.

Style: ${stylePrompts[contentStyle]}
Platform: ${platformGuidelines[platform] || platformGuidelines.reddit}
Promotion: ${promotionText}
${customInstructions ? `Additional instructions: ${customInstructions}` : ''}

Please respond with JSON in this exact format:
{
  "caption": "A brief description of what's happening in the image",
  "titles": ["title1", "title2", "title3"],
  "hashtags": ["#hashtag1", "#hashtag2", "#hashtag3"],
  "postContent": "The main social media post content",
  "photoDescription": "Detailed description of the photo composition, lighting, and mood"
}

Generate 3 different title options. Make the content match the ${contentStyle} style perfectly.
Keep it authentic and engaging for ${platform}.
`;
    try {
        let imageContent;
        if (imageBase64) {
            imageContent = {
                type: "image_url",
                image_url: {
                    url: `data:image/jpeg;base64,${imageBase64}`
                }
            };
        }
        else if (imageUrl) {
            imageContent = {
                type: "image_url",
                image_url: {
                    url: imageUrl
                }
            };
        }
        else {
            throw new Error('No image provided');
        }
        // Use multi-provider system with Gemini first (70x cheaper than OpenAI)
        // Note: This require() will be converted to import() in future refactor
        const { generateWithMultiProvider } = require('./services/multi-ai-provider');
        const response = await generateWithMultiProvider([
            {
                type: "text",
                text: "You are an expert content creator specializing in adult content creation. Analyze images and create engaging, authentic social media content that respects platform guidelines while being appealing and personality-driven.\n\n" + prompt
            },
            imageContent
        ], {
            responseFormat: "json_object",
            maxTokens: 1000,
            temperature: 0.8
        });
        const result = JSON.parse(response.content || '{}');
        return {
            caption: result.caption || "Beautiful moment captured",
            titles: result.titles || ["Check out this amazing shot!", "Feeling confident today", "Living my best life"],
            hashtags: result.hashtags || ["#confidence", "#lifestyle", "#mood"],
            postContent: result.postContent || "Loving this moment and sharing it with you all! What do you think? 💕",
            photoDescription: result.photoDescription || "Beautifully composed image with natural lighting and authentic mood"
        };
    }
    catch (error) {
        console.error('Error generating image caption:', error);
        // Return demo content if AI fails
        return {
            caption: "Beautiful moment captured with perfect lighting and composition",
            titles: [
                "Feeling absolutely radiant today ✨",
                "Sometimes you just gotta capture the moment",
                "Living my best life and loving every second"
            ],
            hashtags: ["#confidence", "#lifestyle", "#mood", "#authentic", "#beautiful"],
            postContent: "This is demo content! In the full version, ThottoPilot would analyze your image and create personalized captions that match your style perfectly. The AI would understand your photo's mood, lighting, and composition to craft engaging content that feels authentically you. Ready to unlock real image-to-caption generation? 🚀",
            photoDescription: "Professional composition with natural lighting, authentic mood, and engaging visual appeal that would resonate perfectly with your audience"
        };
    }
}
// Helper function to convert image file to base64
export function imageToBase64(imagePath) {
    const imageBuffer = fs.readFileSync(imagePath);
    return imageBuffer.toString('base64');
}
// Helper function to validate image format
export function validateImageFormat(filename) {
    const validExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
    const extension = filename.toLowerCase().slice(filename.lastIndexOf('.'));
    return validExtensions.includes(extension);
}
