import OpenAI from 'openai';
import * as z from 'zod';

// Assuming CaptionItem is defined elsewhere and imported
// For the purpose of this example, let's define a placeholder if it's not provided
const CaptionItem = z.object({
  caption: z.string(),
  hashtags: z.array(z.string()),
  safety_level: z.string(),
  mood: z.string(),
  style: z.string(),
  cta: z.string(),
  alt: z.string(),
  nsfw: z.boolean()
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });

export interface FallbackParams {
  platform: string;
  voice: string;
  imageUrl?: string;
  theme?: string;
  context?: string;
  existingCaption?: string;
}

export async function openAICaptionFallback({
  platform,
  voice = "flirty_playful",
  imageUrl,
  existingCaption
}: {
  platform: "instagram" | "x" | "reddit" | "tiktok";
  voice?: string;
  imageUrl?: string;
  existingCaption?: string;
}): Promise<z.infer<typeof CaptionItem>> {
  let messages: any[] = [];

  if (imageUrl && openai) {
    try {
      console.log('OpenAI fallback: Analyzing image for accurate captions');

      if (imageUrl.startsWith('data:')) {
        // For data URLs, we can send directly to OpenAI vision
        messages = [
          {
            role: "system",
            content: `You are an expert social media caption writer. Analyze the image carefully and create engaging ${voice} content for ${platform} that directly relates to what you see.

Return ONLY a JSON object with this structure:
{
  "caption": "engaging caption text that describes what's actually in the image",
  "hashtags": ["#relevant", "#to", "#image"],
  "safety_level": "safe_for_work",
  "mood": "${voice.includes('flirty') ? 'flirty' : 'confident'}",
  "style": "authentic",
  "cta": "relevant call to action",
  "alt": "detailed description of what's actually in the image",
  "nsfw": false
}`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: existingCaption
                  ? `Analyze this image and rewrite this caption to better match what you see: "${existingCaption}"`
                  : `Analyze this image and create a caption that describes what you actually see`
              },
              {
                type: "image_url",
                image_url: { url: imageUrl }
              }
            ]
          }
        ];
      } else {
        // For regular URLs, describe the image request
        messages = [
          {
            role: "system",
            content: `Create engaging ${voice} content for ${platform} based on the image.`
          },
          {
            role: "user",
            content: `Create a caption for an image at: ${imageUrl.substring(0, 100)}...`
          }
        ];
      }
    } catch (error) {
      console.warn('Image analysis failed, using text-only fallback:', error);
      messages = [
        {
          role: "system",
          content: `You are an expert social media caption writer. Create engaging ${voice} content for ${platform}.`
        },
        {
          role: "user",
          content: existingCaption
            ? `Rewrite this caption: "${existingCaption}"`
            : `Create engaging ${voice} content for ${platform}`
        }
      ];
    }
  } else {
    messages = [
      {
        role: "system",
        content: `You are an expert social media caption writer. Create engaging ${voice} content for ${platform}.`
      },
      {
        role: "user",
        content: existingCaption
          ? `Rewrite this caption: "${existingCaption}"`
          : `Create engaging ${voice} content for ${platform}`
      }
    ];
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      response_format: { type: "json_object" },
      max_tokens: 500
    });

    let json: unknown;
    try {
      json = JSON.parse(response.choices[0].message.content || '{}');
    } catch (e) {
      console.error("Error parsing JSON response from OpenAI:", e);
      console.error("OpenAI response content:", response.choices[0].message.content);
      // Fallback to a simpler structure if JSON parsing fails
      json = { caption: response.choices[0].message.content || 'Fallback caption' };
    }

    const jsonData: any = json;
    return {
      caption: jsonData?.caption ?? 'Fallback caption',
      hashtags: jsonData?.hashtags ?? [],
      safety_level: jsonData?.safety_level ?? 'normal',
      mood: jsonData?.mood ?? 'neutral',
      style: jsonData?.style ?? 'fallback',
      cta: jsonData?.cta ?? '',
      alt: jsonData?.alt ?? 'Image description not available',
      nsfw: jsonData?.nsfw ?? false
    };
  } catch (error) {
    console.error("Error calling OpenAI API:", error);
    // Provide a more robust fallback if the API call itself fails
    return {
      caption: existingCaption ? `Could not generate new caption. Original: ${existingCaption}` : 'Error generating caption.',
      hashtags: [],
      safety_level: 'normal',
      mood: 'neutral',
      style: 'error',
      cta: '',
      alt: 'Image description not available',
      nsfw: false
    };
  }
}