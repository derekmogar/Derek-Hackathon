export type AccountCount = "under_50" | "50_200" | "200_500" | "500_plus";
export type ArrBand =
  | "under_1m"
  | "1_5m"
  | "5_10m"
  | "10_25m"
  | "25_50m"
  | "50_plus_m";
export type Crm = "salesforce" | "hubspot" | "other";
export type Maturity = "none" | "ad_hoc" | "documented" | "automated";
export type HealthMaturity = "none" | "intuition" | "rules" | "ml";
export type Routing = "unassigned" | "ad_hoc" | "territory" | "tiered";
export type AutomationMaturity = "manual" | "basic" | "advanced";
export type CsTeamSize = "solo" | "small" | "growing" | "mature";
export type SurpriseChurnBand = "low" | "medium" | "high" | "unknown";
export type Motion =
  | "auto_renewal"
  | "expansion"
  | "early_renewal"
  | "churn_save";

export type Blueprint = {
  accountCount: AccountCount | null;
  arrBand: ArrBand | null;
  crm: Crm | null;
  currentGrr: number | null; // percentage (0-100), null = unknown
  surpriseChurn: SurpriseChurnBand | null;
  staging: Maturity | null;
  health: HealthMaturity | null;
  motions: Motion[];
  routing: Routing | null;
  automation: AutomationMaturity | null;
  csTeam: CsTeamSize | null;
};

export const emptyBlueprint: Blueprint = {
  accountCount: null,
  arrBand: null,
  crm: null,
  currentGrr: null,
  surpriseChurn: null,
  staging: null,
  health: null,
  motions: [],
  routing: null,
  automation: null,
  csTeam: null,
};

export type Stage = "blueprint" | "plan" | "build" | "complete";

export type ChurnImpact = {
  currentGrr: number; // percent
  projectedGrr: number; // percent
  grrLiftPoints: number;
  estimatedArr: number; // dollars
  arrSavedPerYear: number; // dollars
  currentSurpriseChurn: number; // percent (share of churn that is surprise)
  projectedSurpriseChurn: number; // percent
  timeToRiskDetection: string; // e.g. "reactive" or "90 days out"
};

export type PriorityGap = {
  id: string;
  title: string;
  churnImpactPoints: number; // GRR pp lift
  rationale: string;
  effort: "low" | "medium" | "high";
};

export type Approach = "crm_native" | "hybrid" | "cs_platform";

export type Playbook = {
  id: Motion;
  title: string;
  goal: string;
  triggers: string[];
  steps: string[];
  owner: string;
};

export type AutomationSpec = {
  system: "hubspot" | "salesforce" | "generic";
  name: string;
  trigger: string;
  action: string;
  recipient: string;
};

export type Phase = {
  id: string;
  name: string;
  hours: [number, number];
  expectedMilestone: string;
  tasks: { id: string; label: string; owner: string; hours: number }[];
};

export type HealthSignal = {
  name: string;
  weight: number; // percent
  source: string;
  available: "yes" | "likely" | "needs_integration";
};

export type Plan = {
  generatedAt: string;
  impact: ChurnImpact;
  approach: Approach;
  approachRationale: string;
  gaps: PriorityGap[];
  healthDesign: {
    signals: HealthSignal[];
    threshold: { green: number; yellow: number; red: number };
  };
  staging: {
    cadence: { day: 90 | 60 | 30 | 0; action: string; alert: string }[];
    ownerModel: string;
  };
  playbooks: Playbook[];
  routingRules: string[];
  automations: AutomationSpec[];
  phases: Phase[];
  successMetrics: {
    metric: string;
    baseline: string;
    target: string;
  }[];
};
