import type { ArrBand, Blueprint, ChurnImpact } from "./types";

const ARR_MIDPOINTS: Record<ArrBand, number> = {
  under_1m: 500_000,
  "1_5m": 3_000_000,
  "5_10m": 7_500_000,
  "10_25m": 17_500_000,
  "25_50m": 37_500_000,
  "50_plus_m": 75_000_000,
};

const SURPRISE_CHURN_CURRENT: Record<
  NonNullable<Blueprint["surpriseChurn"]>,
  number
> = {
  low: 8,
  medium: 20,
  high: 35,
  unknown: 30,
};

function stagingLift(b: Blueprint): number {
  switch (b.staging) {
    case "none":
      return 2.5;
    case "ad_hoc":
      return 1.5;
    case "documented":
      return 0.5;
    case "automated":
      return 0;
    default:
      return 1;
  }
}

function healthLift(b: Blueprint): number {
  switch (b.health) {
    case "none":
      return 2.2;
    case "intuition":
      return 1.6;
    case "rules":
      return 0.6;
    case "ml":
      return 0;
    default:
      return 1.2;
  }
}

function automationLift(b: Blueprint): number {
  switch (b.automation) {
    case "manual":
      return 1.3;
    case "basic":
      return 0.6;
    case "advanced":
      return 0;
    default:
      return 0.6;
  }
}

function routingLift(b: Blueprint): number {
  switch (b.routing) {
    case "unassigned":
      return 1.2;
    case "ad_hoc":
      return 0.7;
    case "territory":
      return 0.2;
    case "tiered":
      return 0;
    default:
      return 0.5;
  }
}

function motionsLift(b: Blueprint): number {
  let lift = 0;
  const has = (m: string) => b.motions.includes(m as never);
  if (!has("churn_save")) lift += 1.2;
  if (!has("expansion")) lift += 0.6; // NRR contribution
  if (!has("auto_renewal")) lift += 0.3;
  if (!has("early_renewal")) lift += 0.2;
  return lift;
}

export function computeChurnImpact(blueprint: Blueprint): ChurnImpact {
  const baseline = blueprint.currentGrr ?? 90;

  const rawLift =
    stagingLift(blueprint) +
    healthLift(blueprint) +
    automationLift(blueprint) +
    routingLift(blueprint) +
    motionsLift(blueprint);

  // Cap at realistic 5pp ceiling so we don't over-promise
  const grrLift = Math.min(rawLift, 5);
  const projectedGrr = Math.min(baseline + grrLift, 98);

  const arrMid = blueprint.arrBand ? ARR_MIDPOINTS[blueprint.arrBand] : 5_000_000;
  const arrSaved = Math.round(arrMid * (grrLift / 100));

  const currentSurprise = blueprint.surpriseChurn
    ? SURPRISE_CHURN_CURRENT[blueprint.surpriseChurn]
    : 25;
  const projectedSurprise =
    blueprint.health === "ml"
      ? 3
      : blueprint.health === "rules"
        ? 5
        : blueprint.health === "intuition"
          ? 10
          : 5;

  const timeToRiskDetection =
    blueprint.health === "none" || blueprint.health === "intuition"
      ? "Reactive — after the fact"
      : blueprint.health === "rules"
        ? "30 – 60 days out"
        : "90+ days out with ML forecasting";

  return {
    currentGrr: baseline,
    projectedGrr: Number(projectedGrr.toFixed(1)),
    grrLiftPoints: Number(grrLift.toFixed(1)),
    estimatedArr: arrMid,
    arrSavedPerYear: arrSaved,
    currentSurpriseChurn: currentSurprise,
    projectedSurpriseChurn: projectedSurprise,
    timeToRiskDetection,
  };
}

export function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n}`;
}
