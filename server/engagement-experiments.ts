
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
  'conversational-tone-v1': {
    id: 'conversational-tone-v1',
    description: 'Validates conversational Reddit-inspired voice markers for improved engagement.',
    controlVariant: 'control',
    variants: {
      control: 0.5,
      conversational: 0.5
    },
    primaryMetrics: ['upvoteRate', 'commentDepth', 'dwellTime']
  }
};

export function getExperimentDefinition(experimentId: string): ExperimentDefinition | undefined {
  return experimentDefinitions[experimentId];
}

export function assignExperimentVariant(
  experimentId: string,
  random: () => number = Math.random
): ExperimentAssignment {
  const definition = experimentDefinitions[experimentId];
  if (!definition) {
    return {
      id: experimentId,
      variant: 'control',
      isControl: true
    };
  }

  const weights = definition.variants;
  const totalWeight = Object.values(weights).reduce((accumulator, weight) => accumulator + weight, 0);
  const normalizedTotal = totalWeight > 0 ? totalWeight : 1;
  let roll = random() * normalizedTotal;

  for (const [variant, weight] of Object.entries(weights)) {
    roll -= weight;
    if (roll <= 0) {
      return {
        id: experimentId,
        variant,
        isControl: variant === definition.controlVariant
      };
    }
  }

  return {
    id: experimentId,
    variant: definition.controlVariant,
    isControl: true
  };
}

export function isTreatmentVariant(assignment: ExperimentAssignment | undefined): boolean {
  if (!assignment) {
    return false;
  }
  return !assignment.isControl;
}
