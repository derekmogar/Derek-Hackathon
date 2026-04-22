export type AccountCount = "under_50" | "50_200" | "200_500" | "500_plus";
export type ArrBand =
  | "under_1m"
  | "1_5m"
  | "5_10m"
  | "10_25m"
  | "25_50m"
  | "50_plus_m";
export type Crm = "salesforce" | "hubspot" | "other";
export type Motion =
  | "auto_renewal"
  | "expansion"
  | "early_renewal"
  | "churn_save";

/* ========== System Canvas Model ========== */

/** Maturity scale for every component in the renewal system.
 *  0 — Missing (red)
 *  1 — Ad-hoc (amber)
 *  2 — Defined (blue)
 *  3 — Automated (green)
 *  4 — Optimized (gold)
 */
export type Maturity = 0 | 1 | 2 | 3 | 4;

export const MATURITY_LABELS: Record<Maturity, string> = {
  0: "Missing",
  1: "Ad-hoc",
  2: "Defined",
  3: "Automated",
  4: "Optimized",
};

export type Layer = "reporting" | "automation" | "process" | "data" | "team";

export const LAYER_LABELS: Record<Layer, string> = {
  reporting: "Reporting",
  automation: "Automation",
  process: "Process",
  data: "Data",
  team: "Team",
};

export const LAYER_ORDER: Layer[] = [
  "reporting",
  "automation",
  "process",
  "data",
  "team",
];

export type SystemComponent = {
  id: string;
  layer: Layer;
  name: string;
  shortDescription: string; // one-liner on the tile
  description: string; // longer, in panel
  whyItMatters: string; // churn/growth rationale
  impactWeight: number; // 0.0 – 2.5 pp GRR lift when fully built
  nrrWeight?: number; // optional NRR lift contribution
  dependencies?: string[]; // IDs of components this relies on
  benchmark: string; // industry benchmark statement
  maturityDefinitions: Record<Maturity, string>;
  diagnosticQuestions: string[];
  recommendedAction: string;
  playbookExcerpt: string;
  croFraming?: string; // plain-english copy for CRO mode
};

export type SystemContext = {
  clientName: string;
  accountCount: AccountCount | null;
  arrBand: ArrBand | null;
  crm: Crm | null;
  currentGrr: number | null;
};

export type DiscoveryView = "intro" | "component" | "summary" | "playbook";

export type SystemState = {
  components: Record<string, Maturity>;
  notes: Record<string, string>;
  hidden: string[]; // component IDs marked "not relevant"
  context: SystemContext;
  view: DiscoveryView;
  currentIndex: number; // which component screen we're on (0-based over visible list)
  tasksDone: Record<string, boolean>;
};

/* ========== Derived Blueprint (for plan generator) ========== */

export type StagingBand = "none" | "ad_hoc" | "documented" | "automated";
export type HealthBand = "none" | "intuition" | "rules" | "ml";
export type RoutingBand = "unassigned" | "ad_hoc" | "territory" | "tiered";
export type AutomationBand = "manual" | "basic" | "advanced";
export type CsTeamBand = "solo" | "small" | "growing" | "mature";
export type SurpriseBand = "low" | "medium" | "high" | "unknown";

export type Blueprint = {
  accountCount: AccountCount | null;
  arrBand: ArrBand | null;
  crm: Crm | null;
  currentGrr: number | null;
  surpriseChurn: SurpriseBand | null;
  staging: StagingBand | null;
  health: HealthBand | null;
  motions: Motion[];
  routing: RoutingBand | null;
  automation: AutomationBand | null;
  csTeam: CsTeamBand | null;
};

/* ========== Churn + Plan ========== */

export type ChurnImpact = {
  currentGrr: number;
  projectedGrr: number;
  grrLiftPoints: number;
  projectedNrrLift: number; // additional pp from expansion motion
  estimatedArr: number;
  arrSavedPerYear: number;
  arrExpansionPerYear: number;
  currentSurpriseChurn: number;
  projectedSurpriseChurn: number;
  timeToRiskDetection: string;
  systemMaturity: number; // 0-100 average across all components
};

export type PriorityGap = {
  id: string;
  title: string;
  churnImpactPoints: number;
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
  weight: number;
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

export const emptyContext: SystemContext = {
  clientName: "",
  accountCount: null,
  arrBand: null,
  crm: null,
  currentGrr: null,
};

export const emptySystemState: SystemState = {
  components: {},
  notes: {},
  hidden: [],
  context: emptyContext,
  view: "intro",
  currentIndex: 0,
  tasksDone: {},
};
