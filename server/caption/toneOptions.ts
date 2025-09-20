/**
 * Shared tone options for caption generation pipelines
 */

export interface ToneOptions {
  style?: string;
  mood?: string;
  // Note: We intentionally don't use an index signature here to avoid type conflicts
  // Future tone parameters should be explicitly added to this interface
}

/**
 * Extract tone-related parameters from a larger parameter object.
 * This helper ensures we capture all tone options including future additions.
 * 
 * @param params - Object that may contain tone parameters
 * @returns ToneOptions object with extracted tone parameters
 */
export function extractToneOptions(params: Record<string, unknown>): ToneOptions {
  const toneOptions: ToneOptions = {};
  
  // Extract known tone parameters
  if (typeof params.style === 'string') {
    toneOptions.style = params.style;
  }
  
  if (typeof params.mood === 'string') {
    toneOptions.mood = params.mood;
  }
  
  // For future tone parameters, they should be explicitly added to the ToneOptions interface
  // This ensures type safety while allowing for planned extensions
  
  return toneOptions;
}