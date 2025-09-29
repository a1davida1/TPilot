/**
 * Fact coverage checker for captions
 */
export interface FactCoverageInput {
  facts: string[] | string | null | undefined;
  caption: string;
  alt?: string;
}

export interface FactCoverageResult {
  ok: boolean;
  hint?: string;
  coverage: number; // 0-1 percentage
  missingFacts?: string[];
}

/**
 * Ensures that a caption covers the provided image facts
 * Returns coverage information and hints for improvement
 */
export function ensureFactCoverage(input: FactCoverageInput): FactCoverageResult {
  const { facts, caption, alt } = input;

  // Handle empty or missing facts
  if (!facts || (Array.isArray(facts) && facts.length === 0)) {
    return {
      ok: true,
      coverage: 1.0,
      hint: undefined
    };
  }

  // Normalize facts to array
  const factList = Array.isArray(facts) ? facts : [facts];
  const content = `${caption} ${alt || ''}`.toLowerCase();

  // Check which facts are covered
  const coveredFacts: string[] = [];
  const missingFacts: string[] = [];

  for (const fact of factList) {
    if (!fact || typeof fact !== 'string') continue;
    
    const factLower = fact.toLowerCase();
    
    // Simple keyword matching - can be enhanced with more sophisticated NLP
    const isFactCovered = 
      content.includes(factLower) ||
      factLower.split(' ').some(keyword => 
        keyword.length > 3 && content.includes(keyword)
      );

    if (isFactCovered) {
      coveredFacts.push(fact);
    } else {
      missingFacts.push(fact);
    }
  }

  const coverage = coveredFacts.length / factList.length;
  const threshold = 0.7; // 70% coverage required
  const ok = coverage >= threshold;

  let hint: string | undefined;
  if (!ok && missingFacts.length > 0) {
    hint = `Consider including these elements: ${missingFacts.slice(0, 3).join(', ')}`;
  }

  return {
    ok,
    hint,
    coverage,
    missingFacts: missingFacts.length > 0 ? missingFacts : undefined
  };
}