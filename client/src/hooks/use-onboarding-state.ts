import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type { OnboardingState } from '@shared/schema';

interface OnboardingStateData {
  completedSteps: string[];
  isMinimized: boolean;
  isDismissed: boolean;
}

export function useOnboardingState() {
  const query = useQuery<OnboardingStateData>({
    queryKey: ['/api/onboarding/state'],
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<OnboardingStateData>) => {
      const response = await apiRequest('PATCH', '/api/onboarding/state', updates);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/onboarding/state'] });
    },
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    updateState: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
  };
}
