import { describe, expect, it } from "vitest";
import { DASHBOARD_PERFORMANCE_BUDGET_MS, isWithinPerformanceBudget } from "../performance";

describe("dashboard performance budget", () => {
  it("enforces a 3s lighthouse budget", () => {
    expect(DASHBOARD_PERFORMANCE_BUDGET_MS).toBe(3000);
  });

  it("flags durations above the budget", () => {
    expect(isWithinPerformanceBudget(0, 2500)).toBe(true);
    expect(isWithinPerformanceBudget(0, 3500)).toBe(false);
  });

  it("treats invalid metrics as within budget to avoid crashes", () => {
    expect(isWithinPerformanceBudget(Number.NaN, 2000)).toBe(true);
    expect(isWithinPerformanceBudget(1000, Number.NaN)).toBe(true);
  });
});
