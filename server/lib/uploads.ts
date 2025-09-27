const UPLOADS_ROOT = '/uploads';

const sanitizeSegment = (segment: string): string => {
  const trimmed = segment.trim();
  if (!trimmed) {
    return '';
  }

  return trimmed
    .replace(/^\.*/u, '')
    .replace(/[\\]/gu, '')
    .replace(/\s+/gu, '_');
};

export const buildUploadUrl = (...segments: string[]): string => {
  const normalizedSegments = segments
    .flatMap((segment) => segment.split('/'))
    .map(sanitizeSegment)
    .filter((segment) => segment.length > 0)
    .map((segment) => encodeURIComponent(segment));

  return [UPLOADS_ROOT, ...normalizedSegments].join('/');
};