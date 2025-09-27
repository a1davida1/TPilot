// API prefix configuration for consistent API routing
export const API_PREFIX = '/api';

/**
 * Prepends the API prefix to a given path
 * @param path - The path to prefix
 * @param apiPrefix - Optional API prefix (defaults to API_PREFIX)
 * @returns The prefixed path
 */
export function prefixApiPath(path: string, apiPrefix: string = API_PREFIX): string {
  // Remove leading slash from path if present to avoid double slashes
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  
  // Ensure apiPrefix starts with slash and doesn't end with one
  const cleanPrefix = apiPrefix.startsWith('/') ? apiPrefix : `/${apiPrefix}`;
  const normalizedPrefix = cleanPrefix.endsWith('/') ? cleanPrefix.slice(0, -1) : cleanPrefix;
  
  return `${normalizedPrefix}/${cleanPath}`;
}