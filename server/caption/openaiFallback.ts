import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });

export interface FallbackParams {
  platform: string;
  voice: string;
  imageUrl?: string;
  theme?: string;
  context?: string;
  existingCaption?: string;
}

export async function openAICaptionFallback(params: FallbackParams) {
  const { platform, voice, imageUrl, theme, context, existingCaption } = params;
  let prompt = `Generate a social media caption as JSON with fields caption, hashtags, safety_level, mood, style, cta. Platform: ${platform}. Voice: ${voice}.`;
  if (theme) prompt += ` Theme: ${theme}.`;
  if (context) prompt += ` Context: ${context}.`;
  if (existingCaption) prompt += ` Improve this caption: ${existingCaption}`;
  if (imageUrl) prompt += ` Consider the image at ${imageUrl}.`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: 'You are a helpful social media assistant.' },
      { role: 'user', content: prompt }
    ],
    response_format: { type: 'json_object' },
    max_tokens: 500,
    temperature: 0.8
  });

  let json: unknown;
  try {
    json = JSON.parse(response.choices[0].message.content || '{}');
  } catch {
    json = { caption: response.choices[0].message.content || 'Fallback caption' };
  }

  return {
    caption: json.caption || 'Fallback caption',
    hashtags: json.hashtags || [],
    safety_level: json.safety_level || 'normal',
    mood: json.mood || 'neutral',
    style: json.style || 'fallback',
    cta: json.cta || ''
  };
}