import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
const ONBOARDING_STORAGE_KEY = 'thottopilot-onboarding';
export function useOnboarding() {
    const { user, isAuthenticated } = useAuth();
    const [state, setState] = useState(() => {
        if (typeof window === 'undefined') {
            return {
                hasSeenWalkthrough: false,
                completedSteps: [],
                currentTutorial: null,
                lastCompletedAt: null,
            };
        }
        const stored = localStorage.getItem(ONBOARDING_STORAGE_KEY);
        if (stored) {
            try {
                return JSON.parse(stored);
            }
            catch {
                // If parsing fails, return default state
            }
        }
        return {
            hasSeenWalkthrough: false,
            completedSteps: [],
            currentTutorial: null,
            lastCompletedAt: null,
        };
    });
    // Save state to localStorage whenever it changes
    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(state));
        }
    }, [state]);
    // Determine if user should see onboarding
    const shouldShowOnboarding = isAuthenticated && !state.hasSeenWalkthrough;
    const markWalkthroughCompleted = () => {
        setState(prev => ({
            ...prev,
            hasSeenWalkthrough: true,
            lastCompletedAt: new Date().toISOString(),
        }));
    };
    const markStepCompleted = (stepId) => {
        setState(prev => ({
            ...prev,
            completedSteps: [...new Set([...prev.completedSteps, stepId])],
        }));
    };
    const startTutorial = (tutorialId) => {
        setState(prev => ({
            ...prev,
            currentTutorial: tutorialId,
        }));
    };
    const endTutorial = () => {
        setState(prev => ({
            ...prev,
            currentTutorial: null,
        }));
    };
    const resetOnboarding = () => {
        setState({
            hasSeenWalkthrough: false,
            completedSteps: [],
            currentTutorial: null,
            lastCompletedAt: null,
        });
    };
    // Force show onboarding (for testing or manual trigger)
    const showOnboarding = () => {
        setState(prev => ({
            ...prev,
            hasSeenWalkthrough: false,
        }));
    };
    return {
        state,
        shouldShowOnboarding,
        markWalkthroughCompleted,
        markStepCompleted,
        startTutorial,
        endTutorial,
        resetOnboarding,
        showOnboarding,
        isStepCompleted: (stepId) => state.completedSteps.includes(stepId),
    };
}
