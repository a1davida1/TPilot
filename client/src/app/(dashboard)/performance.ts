export const DASHBOARD_PERFORMANCE_BUDGET_MS = 3000;

export function isWithinPerformanceBudget(start: number, end: number, budget: number = DASHBOARD_PERFORMANCE_BUDGET_MS): boolean {
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return true;
  }

  return end - start <= budget;
}
