import type {
  AutomationBand,
  Blueprint,
  CsTeamBand,
  HealthBand,
  Maturity,
  Motion,
  RoutingBand,
  StagingBand,
  SurpriseBand,
  SystemState,
} from "./types";

/** Convert SystemState → Blueprint shape for the existing plan generator.
 *  The plan generator was designed around string-enum fields; this adapter
 *  translates the maturity-level canvas state into those bands.
 */
export function systemStateToBlueprint(state: SystemState): Blueprint {
  const m = (id: string): Maturity => (state.components[id] ?? 0) as Maturity;

  const motions: Motion[] = [];
  if (m("auto_renewal") >= 2) motions.push("auto_renewal");
  if (m("expansion_motion") >= 2) motions.push("expansion");
  if (m("early_renewal") >= 2) motions.push("early_renewal");
  if (m("save_playbook") >= 2) motions.push("churn_save");

  return {
    accountCount: state.context.accountCount,
    arrBand: state.context.arrBand,
    crm: state.context.crm,
    currentGrr: state.context.currentGrr,
    surpriseChurn: deriveSurprise(m("health_engine"), m("risk_report")),
    staging: deriveStaging(m("alerts_906030")),
    health: deriveHealth(m("health_engine")),
    motions,
    routing: deriveRouting(m("csm_routing"), m("routing_engine")),
    automation: deriveAutomation(m("alerts_906030"), m("routing_engine")),
    csTeam: deriveCsTeam(state.context.accountCount),
  };
}

function deriveSurprise(health: Maturity, risk: Maturity): SurpriseBand {
  if (health === 0 && risk === 0) return "high";
  if (health <= 1 || risk === 0) return "medium";
  return "low";
}

function deriveStaging(alerts: Maturity): StagingBand {
  if (alerts === 0) return "none";
  if (alerts === 1) return "ad_hoc";
  if (alerts === 2) return "documented";
  return "automated";
}

function deriveHealth(health: Maturity): HealthBand {
  if (health === 0) return "none";
  if (health === 1) return "intuition";
  if (health === 2) return "rules";
  return "ml";
}

function deriveRouting(csmRouting: Maturity, routingEngine: Maturity): RoutingBand {
  const peak = Math.max(csmRouting, routingEngine);
  if (peak === 0) return "unassigned";
  if (peak === 1) return "ad_hoc";
  if (peak === 2) return "territory";
  return "tiered";
}

function deriveAutomation(alerts: Maturity, routing: Maturity): AutomationBand {
  const avg = (alerts + routing) / 2;
  if (avg >= 3) return "advanced";
  if (avg >= 1.5) return "basic";
  return "manual";
}

function deriveCsTeam(accountCount: Blueprint["accountCount"]): CsTeamBand | null {
  if (!accountCount) return null;
  if (accountCount === "under_50") return "solo";
  if (accountCount === "50_200") return "small";
  if (accountCount === "200_500") return "growing";
  return "mature";
}
