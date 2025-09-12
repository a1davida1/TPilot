export function embedSignature(buffer: Buffer, signature: string): Buffer {
  const bytes = Buffer.from(signature);
  const data = Buffer.from(buffer);

  bytes.forEach((byte, i) => {
    for (let bit = 0; bit < 8; bit++) {
      const idx = i * 8 + bit;
      if (idx >= data.length) return;
      data[idx] = (data[idx] & 0xfe) | ((byte >> (7 - bit)) & 1);
    }
  });

  return data;
}