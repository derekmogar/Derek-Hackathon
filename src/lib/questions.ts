import type {
  AccountCount,
  ArrBand,
  AutomationMaturity,
  Crm,
  CsTeamSize,
  HealthMaturity,
  Maturity,
  Motion,
  Routing,
  SurpriseChurnBand,
} from "./types";

type Option<V extends string> = { value: V; label: string; sub?: string };

export type Question =
  | {
      id: "accountCount";
      prompt: string;
      help: string;
      kind: "single";
      options: Option<AccountCount>[];
    }
  | {
      id: "arrBand";
      prompt: string;
      help: string;
      kind: "single";
      options: Option<ArrBand>[];
    }
  | {
      id: "crm";
      prompt: string;
      help: string;
      kind: "single";
      options: Option<Crm>[];
    }
  | {
      id: "currentGrr";
      prompt: string;
      help: string;
      kind: "grr";
    }
  | {
      id: "surpriseChurn";
      prompt: string;
      help: string;
      kind: "single";
      options: Option<SurpriseChurnBand>[];
    }
  | {
      id: "staging";
      prompt: string;
      help: string;
      kind: "single";
      options: Option<Maturity>[];
    }
  | {
      id: "health";
      prompt: string;
      help: string;
      kind: "single";
      options: Option<HealthMaturity>[];
    }
  | {
      id: "motions";
      prompt: string;
      help: string;
      kind: "multi";
      options: Option<Motion>[];
    }
  | {
      id: "routing";
      prompt: string;
      help: string;
      kind: "single";
      options: Option<Routing>[];
    }
  | {
      id: "automation";
      prompt: string;
      help: string;
      kind: "single";
      options: Option<AutomationMaturity>[];
    }
  | {
      id: "csTeam";
      prompt: string;
      help: string;
      kind: "single";
      options: Option<CsTeamSize>[];
    };

export const questions: Question[] = [
  {
    id: "accountCount",
    prompt: "How many active customer accounts do you manage?",
    help: "Account count drives whether CRM-native, hybrid, or a dedicated CS platform is the right fit.",
    kind: "single",
    options: [
      { value: "under_50", label: "Under 50", sub: "CRM-native is likely enough" },
      { value: "50_200", label: "50 – 200", sub: "Hybrid CRM + lightweight tooling" },
      { value: "200_500", label: "200 – 500", sub: "CS platform usually justified" },
      { value: "500_plus", label: "500+", sub: "Dedicated CS platform required" },
    ],
  },
  {
    id: "arrBand",
    prompt: "What's your approximate annual recurring revenue?",
    help: "ARR anchors the dollar impact of the churn reduction this engine is designed to deliver.",
    kind: "single",
    options: [
      { value: "under_1m", label: "< $1M ARR" },
      { value: "1_5m", label: "$1M – $5M" },
      { value: "5_10m", label: "$5M – $10M" },
      { value: "10_25m", label: "$10M – $25M" },
      { value: "25_50m", label: "$25M – $50M" },
      { value: "50_plus_m", label: "$50M+" },
    ],
  },
  {
    id: "crm",
    prompt: "Which CRM is the system of record?",
    help: "The automation specs in your plan will be tailored to this system.",
    kind: "single",
    options: [
      { value: "salesforce", label: "Salesforce" },
      { value: "hubspot", label: "HubSpot" },
      { value: "other", label: "Other / multiple" },
    ],
  },
  {
    id: "currentGrr",
    prompt: "What's your current Gross Revenue Retention?",
    help: "B2B SaaS median is 90%. Top quartile is 95%+. Enter your best estimate — 'Unknown' is valid.",
    kind: "grr",
  },
  {
    id: "surpriseChurn",
    prompt: "What share of your churn is a surprise — no risk flag in advance?",
    help: "Surprise churn measures your early-warning coverage. Top-performing CS orgs get this under 5%.",
    kind: "single",
    options: [
      { value: "low", label: "Under 10%", sub: "Strong signal coverage" },
      { value: "medium", label: "10 – 30%", sub: "Moderate blind spots" },
      { value: "high", label: "Over 30%", sub: "Reactive — high exposure" },
      { value: "unknown", label: "We don't track this" },
    ],
  },
  {
    id: "staging",
    prompt: "Do you have a 90 / 60 / 30-day renewal cadence?",
    help: "Staged cadence gives you forward visibility and creates intervention windows.",
    kind: "single",
    options: [
      { value: "none", label: "No cadence", sub: "Renewals discovered at invoice time" },
      { value: "ad_hoc", label: "Ad-hoc", sub: "CSMs do it their own way" },
      { value: "documented", label: "Documented", sub: "Standardized but manual" },
      { value: "automated", label: "Automated", sub: "Alerts + tasks fire on their own" },
    ],
  },
  {
    id: "health",
    prompt: "How mature is your customer health scoring?",
    help: "Health scores identify at-risk accounts 3-6 months before churn — the single highest-leverage signal in retention.",
    kind: "single",
    options: [
      { value: "none", label: "No health score" },
      { value: "intuition", label: "CSM intuition only" },
      { value: "rules", label: "Rules-based", sub: "Weighted signals in a formula" },
      { value: "ml", label: "ML-driven", sub: "Trained on historical churn" },
    ],
  },
  {
    id: "motions",
    prompt: "Which renewal motions do you run today? (select all)",
    help: "Each motion handles a different retention scenario. Most orgs start with 1-2.",
    kind: "multi",
    options: [
      { value: "auto_renewal", label: "Auto-renewal", sub: "Silent renewals with optional review" },
      { value: "expansion", label: "Expansion at renewal", sub: "Upsell / cross-sell during cycle" },
      { value: "early_renewal", label: "Early renewal", sub: "Locking in before the window" },
      { value: "churn_save", label: "Churn save play", sub: "Active intervention on at-risk" },
    ],
  },
  {
    id: "routing",
    prompt: "How are renewals routed to an owner?",
    help: "Unowned renewals are the single most preventable source of churn.",
    kind: "single",
    options: [
      { value: "unassigned", label: "Often unassigned", sub: "Things fall through the cracks" },
      { value: "ad_hoc", label: "Ad-hoc", sub: "Decided case-by-case" },
      { value: "territory", label: "Territory / segment", sub: "Routed by rules" },
      { value: "tiered", label: "Tiered named-account", sub: "Enterprise / Mid / SMB model" },
    ],
  },
  {
    id: "automation",
    prompt: "How automated is your renewal process today?",
    help: "Manual tracking is where the biggest hours hide — and where missed renewals start.",
    kind: "single",
    options: [
      { value: "manual", label: "Manual / spreadsheets" },
      { value: "basic", label: "Some alerts", sub: "A few CRM reminders" },
      { value: "advanced", label: "Full workflow automation" },
    ],
  },
  {
    id: "csTeam",
    prompt: "What's the shape of your CS team?",
    help: "Team size shapes how much the plan leans on process vs. tooling.",
    kind: "single",
    options: [
      { value: "solo", label: "Solo CSM" },
      { value: "small", label: "Small (2 – 5)" },
      { value: "growing", label: "Growing (6 – 15)" },
      { value: "mature", label: "Mature (16+)" },
    ],
  },
];
