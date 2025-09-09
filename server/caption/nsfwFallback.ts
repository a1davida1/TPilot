import { Buffer } from 'node:buffer';

export interface NSFWCaption {
  caption: string;
  alt: string;
  hashtags: string[];
  cta: string;
  mood: string;
  style: string;
  safety_level: string;
  nsfw: boolean;
}

async function fetchImage(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`failed to fetch image: ${res.status} ${res.statusText}`);
  }
  const arr = await res.arrayBuffer();
  return Buffer.from(arr);
}

async function detectNSFW(image: Buffer): Promise<boolean> {
  const res = await fetch(
    'https://api-inference.huggingface.co/models/Falconsai/nsfw_image_detection',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.HF_API_KEY ?? ''}` },
      body: image,
    },
  );
  if (!res.ok) return false;
  const data: unknown = await res.json();
  if (Array.isArray(data)) {
    const nsfwScore = data
      .filter(
        (d: unknown): d is { label: string; score: number } =>
          typeof d === 'object' &&
          d !== null &&
          typeof (d as { label?: unknown }).label === 'string' &&
          typeof (d as { score?: unknown }).score === 'number',
      )
      .find((d) => d.label.toLowerCase() === 'nsfw')?.score;
    return (nsfwScore ?? 0) > 0.5;
  }
  return false;
}

async function captionImage(image: Buffer): Promise<string> {
  const res = await fetch(
    'https://api-inference.huggingface.co/models/Salesforce/blip-image-captioning-large',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.HF_API_KEY ?? ''}` },
      body: image,
    },
  );
  if (!res.ok) {
    throw new Error('caption request failed');
  }
  const data: unknown = await res.json();
  if (Array.isArray(data)) {
    const text = data
      .filter(
        (d: unknown): d is { generated_text: string } =>
          typeof d === 'object' &&
          d !== null &&
          typeof (d as { generated_text?: unknown }).generated_text === 'string',
      )[0]?.generated_text;
    if (text) return text;
  }
  throw new Error('invalid caption response');
}

export async function nsfwCaptionFallback(imageUrl: string): Promise<NSFWCaption> {
  const image = await fetchImage(imageUrl);
  const isNsfw = await detectNSFW(image);
  const caption = await captionImage(image);
  const altBase = `${caption} - adult content`;
  const alt = altBase.length < 20 ? `${altBase} image.` : altBase;
  return {
    caption: isNsfw ? `[NSFW] ${caption}` : caption,
    alt,
    hashtags: ['#nsfw'],
    cta: 'See more',
    mood: 'provocative',
    style: 'explicit',
    safety_level: 'nsfw',
    nsfw: isNsfw,
  };
}