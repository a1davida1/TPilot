export const API_PREFIX = '/api' as const;

function normalizePrefix(prefix: string): string {
  if (!prefix.startsWith('/')) {
    return `/${prefix}`;
  }
  return prefix.endsWith('/') && prefix !== '/' ? prefix.slice(0, -1) : prefix;
}

function normalizePath(path: string): string {
  if (!path.startsWith('/')) {
    return `/${path}`;
  }
  return path;
}

export function prefixApiPath(path: string, apiPrefix: string = API_PREFIX): string {
  const normalizedPrefix = normalizePrefix(apiPrefix);
  const normalizedPath = normalizePath(path);
  if (normalizedPath === '/' && normalizedPrefix === '/') {
    return '/';
  }
  if (normalizedPrefix === '/') {
    return normalizedPath;
  }
  if (normalizedPath === '/') {
    return normalizedPrefix;
  }
  return `${normalizedPrefix}${normalizedPath}`;
}