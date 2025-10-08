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

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxAttempts = 3,
  initialDelayMs = 200,
): Promise<T> {
  let lastError: unknown;
  let delayMs = initialDelayMs;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts) {
        break;
      }
      await delay(delayMs);
      delayMs *= 2;
    }
  }
  if (lastError instanceof Error) {
    throw lastError;
  }
  throw new Error('operation failed without error details');
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
  try {
    const res = await retryWithBackoff(async () => {
      const response = await fetch(
        'https://api-inference.huggingface.co/models/Falconsai/nsfw_image_detection',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${process.env.HF_API_KEY ?? ''}` },
          body: image,
        },
      );
      if (!response.ok) {
        throw new Error('nsfw detection request failed');
      }
      return response;
    });
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
  } catch (_error) {
    return false;
  }

  return false;
}

async function captionImage(image: Buffer): Promise<string> {
  const res = await retryWithBackoff(async () => {
    const response = await fetch(
      'https://api-inference.huggingface.co/models/Salesforce/blip-image-captioning-large',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.HF_API_KEY ?? ''}` },
        body: image,
      },
    );
    if (!response.ok) {
      throw new Error('caption request failed');
    }
    return response;
  });
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
    style: 'needs_review',
    safety_level: 'nsfw',
    nsfw: isNsfw,
  };
}