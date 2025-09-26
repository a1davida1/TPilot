
export interface ExperimentDefinition {
  readonly id: string;
  readonly description: string;
  readonly controlVariant: string;
  readonly variants: Record<string, number>;
  readonly primaryMetrics: readonly string[];
}

export interface ExperimentAssignment {
  readonly id: string;
  readonly variant: string;
  readonly isControl: boolean;
}

const experimentDefinitions: Record<string, ExperimentDefinition> = {
  'voice-markers-2024': {
    id: 'voice-markers-2024',
    description: 'Test impact of increased voice marker density on engagement',
    controlVariant: 'control',
    variants: {
      'control': 0.5,
      'treatment': 0.5
    },
    primaryMetrics: ['engagement_rate', 'authenticity_score']
  },
  'community-callbacks-2024': {
    id: 'community-callbacks-2024',
    description: 'Test community-specific humor references and callbacks',
    controlVariant: 'baseline',
    variants: {
      'baseline': 0.4,
      'humor-light': 0.3,
      'humor-heavy': 0.3
    },
    primaryMetrics: ['comment_rate', 'upvote_rate']
  }
};

export function getExperimentDefinition(experimentId: string): ExperimentDefinition | undefined {
  return experimentDefinitions[experimentId];
}

export function assignExperimentVariant(experimentId: string, random: () => number): ExperimentAssignment | undefined {
  const definition = getExperimentDefinition(experimentId);
  if (!definition) {
    return undefined;
  }

  const randomValue = random();
  let cumulativeProbability = 0;

  for (const [variant, probability] of Object.entries(definition.variants)) {
    cumulativeProbability += probability;
    if (randomValue <= cumulativeProbability) {
      return {
        id: experimentId,
        variant,
        isControl: variant === definition.controlVariant
      };
    }
  }

  // Fallback to control variant
  return {
    id: experimentId,
    variant: definition.controlVariant,
    isControl: true
  };
}

export function isTreatmentVariant(assignment: ExperimentAssignment): boolean {
  return !assignment.isControl;
}
