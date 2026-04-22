import { SYSTEM_COMPONENTS } from "./components-catalog";
import type {
  ArrBand,
  ChurnImpact,
  Maturity,
  SystemComponent,
  SystemState,
} from "./types";

const ARR_MIDPOINTS: Record<ArrBand, number> = {
  under_1m: 500_000,
  "1_5m": 3_000_000,
  "5_10m": 7_500_000,
  "10_25m": 17_500_000,
  "25_50m": 37_500_000,
  "50_plus_m": 75_000_000,
};

const TARGET_MATURITY: Maturity = 3; // Automated — realistic ceiling for lift calc

/** Each component contributes to GRR lift proportional to the gap
 *  between current maturity and target (3 "Automated"). Cap total at 5pp.
 */
export function computeChurnImpact(state: SystemState): ChurnImpact {
  const baseline = state.context.currentGrr ?? 90;

  let grrLift = 0;
  let nrrLift = 0;
  let totalComponents = 0;
  let maturitySum = 0;

  for (const comp of SYSTEM_COMPONENTS) {
    const current = state.components[comp.id] ?? 0;
    totalComponents += 1;
    maturitySum += current;

    const gap = Math.max(0, TARGET_MATURITY - current);
    const fraction = gap / TARGET_MATURITY;

    grrLift += comp.impactWeight * fraction;
    if (comp.nrrWeight) {
      nrrLift += comp.nrrWeight * fraction;
    }
  }

  grrLift = Math.min(grrLift, 5);
  nrrLift = Math.min(nrrLift, 10);

  const projectedGrr = Math.min(baseline + grrLift, 98);

  const arrMid = state.context.arrBand
    ? ARR_MIDPOINTS[state.context.arrBand]
    : 5_000_000;
  const arrSaved = Math.round(arrMid * (grrLift / 100));
  const arrExpansion = Math.round(arrMid * (nrrLift / 100));

  // Surprise churn rate: depends on health + risk-reporting maturity
  const healthMaturity = state.components.health_engine ?? 0;
  const riskReport = state.components.risk_report ?? 0;
  const currentSurprise = inferCurrentSurpriseChurn(healthMaturity, riskReport);
  const projectedSurprise = inferProjectedSurpriseChurn(healthMaturity, riskReport);

  const timeToRiskDetection = inferRiskDetectionWindow(healthMaturity, riskReport);

  const systemMaturity =
    totalComponents > 0 ? Math.round((maturitySum / (totalComponents * 4)) * 100) : 0;

  return {
    currentGrr: baseline,
    projectedGrr: Number(projectedGrr.toFixed(1)),
    grrLiftPoints: Number(grrLift.toFixed(1)),
    projectedNrrLift: Number(nrrLift.toFixed(1)),
    estimatedArr: arrMid,
    arrSavedPerYear: arrSaved,
    arrExpansionPerYear: arrExpansion,
    currentSurpriseChurn: currentSurprise,
    projectedSurpriseChurn: projectedSurprise,
    timeToRiskDetection,
    systemMaturity,
  };
}

function inferCurrentSurpriseChurn(health: Maturity, risk: Maturity): number {
  if (health === 0 && risk === 0) return 35;
  if (health <= 1 || risk === 0) return 25;
  if (health <= 2 && risk <= 1) return 15;
  return 8;
}

function inferProjectedSurpriseChurn(health: Maturity, risk: Maturity): number {
  if (health >= 3 && risk >= 3) return 3;
  if (health >= 2 && risk >= 2) return 5;
  if (health >= 1 || risk >= 1) return 10;
  return 15;
}

function inferRiskDetectionWindow(health: Maturity, risk: Maturity): string {
  if (health === 0) return "Reactive — after the fact";
  if (health === 1) return "Days — from CSM pulse check";
  if (health === 2) return "30 – 60 days with rules-based score";
  if (health === 3) return "60 – 90 days with automated engine";
  return "90+ days with ML-driven forecasting";
}

export function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n}`;
}

/** Identify components that are below target and return ranked list
 *  for priority gap display. */
export function rankGaps(state: SystemState): Array<{
  component: SystemComponent;
  current: Maturity;
  liftAvailable: number;
}> {
  return SYSTEM_COMPONENTS.map((comp) => {
    const current = state.components[comp.id] ?? 0;
    const gap = Math.max(0, TARGET_MATURITY - current);
    const liftAvailable = comp.impactWeight * (gap / TARGET_MATURITY);
    return { component: comp, current, liftAvailable };
  })
    .filter((x) => x.liftAvailable > 0)
    .sort((a, b) => b.liftAvailable - a.liftAvailable);
}

/** Which components are blocked by a missing dependency? */
export function findBrokenChains(state: SystemState): Record<string, string[]> {
  const broken: Record<string, string[]> = {};
  for (const comp of SYSTEM_COMPONENTS) {
    if (!comp.dependencies) continue;
    const missing = comp.dependencies.filter(
      (depId) => (state.components[depId] ?? 0) === 0,
    );
    if (missing.length > 0 && (state.components[comp.id] ?? 0) > 0) {
      broken[comp.id] = missing;
    }
  }
  return broken;
}
