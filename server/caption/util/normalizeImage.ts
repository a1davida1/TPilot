export function normalizeImageForOpenAI(input?: string | null): string | undefined {
  if (!input) return undefined;
  if (input.startsWith('data:')) return input;
  const b64 = /^[A-Za-z0-9+/]+={0,2}$/.test(input) && input.length % 4 === 0;
  return b64 ? `data:image/png;base64,${input}` : input;
}
