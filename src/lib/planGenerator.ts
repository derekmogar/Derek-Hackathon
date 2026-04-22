import { computeChurnImpact } from "./churnImpact";
import type {
  Approach,
  AutomationSpec,
  Blueprint,
  HealthSignal,
  Phase,
  Plan,
  Playbook,
  PriorityGap,
} from "./types";

function recommendApproach(blueprint: Blueprint): {
  approach: Approach;
  rationale: string;
} {
  const count = blueprint.accountCount;
  if (count === "500_plus")
    return {
      approach: "cs_platform",
      rationale:
        "At 500+ accounts, a dedicated CS platform (Gainsight, ChurnZero, Totango) is required to scale health scoring, playbook automation, and CSM workload management.",
    };
  if (count === "200_500")
    return {
      approach: "cs_platform",
      rationale:
        "At 200–500 accounts, CRM-native tooling starts to break down. A CS platform on top of your CRM is where the retention math works out.",
    };
  if (count === "50_200")
    return {
      approach: "hybrid",
      rationale:
        "At 50–200 accounts, a hybrid build — CRM for source-of-truth plus lightweight health-scoring tooling (Vitally, Planhat) — gives you real capability without full CS-platform overhead.",
    };
  return {
    approach: "crm_native",
    rationale:
      "Under 50 accounts, build the whole engine inside your CRM. The automation ROI doesn't yet justify a dedicated CS platform.",
  };
}

function buildGaps(blueprint: Blueprint): PriorityGap[] {
  const gaps: PriorityGap[] = [];

  if (blueprint.routing === "unassigned" || blueprint.routing === "ad_hoc") {
    gaps.push({
      id: "ownership",
      title: "Assign a renewal owner to every account",
      churnImpactPoints: 1.2,
      rationale:
        "Unowned renewals are the single most preventable source of churn. Make renewal owner a required CRM field; enforce via validation rule.",
      effort: "low",
    });
  }

  if (blueprint.health === "none" || blueprint.health === "intuition") {
    gaps.push({
      id: "health",
      title: "Stand up a rules-based health score",
      churnImpactPoints: 2.0,
      rationale:
        "Health scoring gives CSMs X-ray vision into declining accounts 3–6 months before renewal. Start with a weighted formula combining usage, support, and engagement signals.",
      effort: "medium",
    });
  }

  if (blueprint.staging === "none" || blueprint.staging === "ad_hoc") {
    gaps.push({
      id: "cadence",
      title: "Install a 90/60/30-day renewal cadence",
      churnImpactPoints: 1.8,
      rationale:
        "Staged alerts create the intervention windows CSMs need. Without them, renewals are discovered at invoice time — already too late.",
      effort: "medium",
    });
  }

  if (!blueprint.motions.includes("churn_save")) {
    gaps.push({
      id: "save_play",
      title: "Build a churn save playbook",
      churnImpactPoints: 1.0,
      rationale:
        "A documented intervention script (discovery → concession authority → executive escalation) converts 20–40% of at-risk accounts that would otherwise churn.",
      effort: "low",
    });
  }

  if (blueprint.automation === "manual") {
    gaps.push({
      id: "automation",
      title: "Automate the alert + task firing layer",
      churnImpactPoints: 1.2,
      rationale:
        "Manual tracking burns 3–5 hours/CSM/week and misses renewals when the owner is out. Automation removes single-point-of-failure risk.",
      effort: "medium",
    });
  }

  if (!blueprint.motions.includes("expansion")) {
    gaps.push({
      id: "expansion",
      title: "Wire expansion conversations into the renewal motion",
      churnImpactPoints: 0.6,
      rationale:
        "The renewal window is the highest-signal moment for upsell and cross-sell. Most orgs leave NRR on the table because expansion is a separate process.",
      effort: "low",
    });
  }

  return gaps.sort((a, b) => b.churnImpactPoints - a.churnImpactPoints).slice(0, 5);
}

function buildHealthDesign(blueprint: Blueprint): Plan["healthDesign"] {
  const base: HealthSignal[] = [
    {
      name: "Product usage trend (30d)",
      weight: 30,
      source: "Product analytics (Pendo/Mixpanel) or native logs",
      available:
        blueprint.crm === "salesforce" || blueprint.crm === "hubspot"
          ? "needs_integration"
          : "likely",
    },
    {
      name: "Support ticket volume + sentiment",
      weight: 15,
      source: "Zendesk / Intercom / HubSpot Service",
      available: blueprint.crm === "hubspot" ? "yes" : "likely",
    },
    {
      name: "NPS / CSAT delta",
      weight: 10,
      source: "Delighted / SurveyMonkey / native survey tool",
      available: "likely",
    },
    {
      name: "Engagement (email, QBRs, exec-sponsor coverage)",
      weight: 20,
      source: "CRM activity history",
      available: "yes",
    },
    {
      name: "CSM pulse score (manual)",
      weight: 15,
      source: "CRM picklist, CSM-entered weekly",
      available: "yes",
    },
    {
      name: "Contract / billing signals (payment delay, downgrade)",
      weight: 10,
      source: "Billing system + CRM",
      available: "yes",
    },
  ];

  return {
    signals: base,
    threshold: { green: 80, yellow: 60, red: 40 },
  };
}

function buildStaging(blueprint: Blueprint): Plan["staging"] {
  const cadence: Plan["staging"]["cadence"] = [
    {
      day: 90,
      action:
        "Renewal owner reviews account: health score, usage trend, executive sponsor status, known risks",
      alert: "CRM task + Slack alert to renewal owner 90 days before contract end",
    },
    {
      day: 60,
      action:
        "Renewal conversation scheduled; expansion / multi-year options prepared; pricing pre-approved",
      alert: "Second CRM task + email escalation to CSM manager if task not completed",
    },
    {
      day: 30,
      action:
        "Paperwork / order form issued; executive escalation path engaged if unresolved",
      alert: "Task + VP-level visibility on renewal pipeline dashboard",
    },
    {
      day: 0,
      action: "Contract signed or churn-save playbook triggered",
      alert: "Post-mortem task auto-created for any churned account",
    },
  ];

  const ownerModel =
    blueprint.routing === "tiered"
      ? "Keep current tiered named-account model; add 'Renewal Owner' as required field distinct from Account Owner."
      : blueprint.routing === "territory"
        ? "Keep territory routing; add required 'Renewal Owner' field with validation rule."
        : "Assign every active customer a required Renewal Owner (CSM for managed accounts, pooled CSM for long-tail).";

  return { cadence, ownerModel };
}

function buildPlaybooks(blueprint: Blueprint): Playbook[] {
  const hasMotion = (m: string) => blueprint.motions.includes(m as never);
  const books: Playbook[] = [];

  books.push({
    id: "auto_renewal",
    title: "Auto-Renewal Motion",
    goal: "Silent renewal for healthy accounts; CSM review only for flagged accounts.",
    triggers: [
      "90 days before contract end",
      "Account health = green",
      "No open support escalations",
    ],
    steps: [
      "Verify billing, contract terms, and exec sponsor status",
      "Send renewal notice + invoice 60 days out",
      "Flag to CSM only if health drops below green",
      "Auto-close renewal as won if no response + payment received",
    ],
    owner: "CS Ops + Finance",
  });

  books.push({
    id: "expansion",
    title: "Expansion at Renewal",
    goal: "Turn every renewal into an NRR conversation.",
    triggers: [
      "90 days before contract end",
      "Usage growth > 30% YoY, or new product fit identified",
      "Executive sponsor engaged in last 60 days",
    ],
    steps: [
      "Run usage-gap analysis: which paid features are underused, which unpaid features are being hit?",
      "CSM + AE joint discovery call on expansion hypothesis",
      "Propose multi-year / higher-tier / module add-on",
      "Document deal in pipeline as expansion + renewal bundle",
    ],
    owner: "CSM leads, AE supports",
  });

  books.push({
    id: "early_renewal",
    title: "Early Renewal Lock-In",
    goal: "Lock in highly healthy accounts early (3-6 months pre-renewal) in exchange for term or volume commitment.",
    triggers: [
      "Health = green for 2+ consecutive quarters",
      "Account is reference-eligible",
      "Strategic reason to secure the account (budget-cycle, competitor displacement)",
    ],
    steps: [
      "Identify candidates from renewal pipeline dashboard, top decile by health",
      "Executive sponsor meeting: float early renewal with incentive (1-2 months free, locked pricing, multi-year discount)",
      "Close early to remove re-evaluation risk",
    ],
    owner: "VP CS + CSM",
  });

  books.push({
    id: "churn_save",
    title: "Churn Save Play",
    goal: "Intervene on at-risk accounts before the renewal decision is made.",
    triggers: [
      "Health score turns yellow or red",
      "Executive sponsor leaves",
      "Downgrade signal (seat reduction, reduced usage > 40%)",
    ],
    steps: [
      "CSM opens a save motion in CRM (creates objection/concern log)",
      "Discovery call: root cause (product, onboarding, relationship, contract)",
      "Save package built: concession authority, success plan, executive escalation",
      "VP CS approval if concession exceeds thresholds",
      "Tracked outcome: saved / downgraded / churned with reason-coded post-mortem",
    ],
    owner: "CSM leads, VP CS approves",
  });

  // Return all 4 but mark which ones are new vs existing (for styling later)
  return books.filter((b) => {
    if (b.id === "expansion" && !hasMotion("expansion")) return true;
    if (b.id === "early_renewal" && !hasMotion("early_renewal")) return true;
    if (b.id === "churn_save" && !hasMotion("churn_save")) return true;
    if (b.id === "auto_renewal") return true;
    return true;
  });
}

function buildRoutingRules(blueprint: Blueprint): string[] {
  const rules: string[] = [];
  if (blueprint.routing === "unassigned" || blueprint.routing === "ad_hoc") {
    rules.push(
      "Required field: Renewal Owner (CRM validation rule blocks save if empty on active accounts).",
    );
  }
  rules.push(
    "Enterprise tier (> $100K ACV): named CSM + VP CS as escalation contact.",
  );
  rules.push(
    "Mid-market ($25K – $100K ACV): named CSM, shared manager escalation.",
  );
  rules.push(
    "SMB (< $25K ACV): pooled CSM queue with round-robin assignment on 90-day trigger.",
  );
  if (blueprint.csTeam === "solo" || blueprint.csTeam === "small") {
    rules.push(
      "Coverage ratio cap: no CSM carries more than 40 managed accounts. Excess routes to pooled queue.",
    );
  } else {
    rules.push(
      "Coverage ratio cap: 60 accounts per CSM (Enterprise), 120 per CSM (Mid), pooled queue for SMB.",
    );
  }
  return rules;
}

function buildAutomations(blueprint: Blueprint): AutomationSpec[] {
  const system =
    blueprint.crm === "salesforce"
      ? "salesforce"
      : blueprint.crm === "hubspot"
        ? "hubspot"
        : "generic";

  const specs: AutomationSpec[] = [];

  if (system === "hubspot") {
    specs.push({
      system,
      name: "Renewal 90-Day Trigger Workflow",
      trigger: "Deal 'Contract End Date' is 90 days away AND Deal Stage = Active Subscription",
      action:
        "Create Task: 'Renewal review — 90 day', due +2 days, associated to Renewal Owner; post in #renewal-pipeline Slack channel with health score context",
      recipient: "Renewal Owner",
    });
    specs.push({
      system,
      name: "Health Score Risk Alert",
      trigger: "Contact/Company property 'Health Score' transitions to Yellow or Red",
      action:
        "Create CTA task for Renewal Owner + CSM Manager: 'Risk intervention — root cause discovery within 5 business days'",
      recipient: "Renewal Owner + Manager",
    });
    specs.push({
      system,
      name: "Missing Renewal Owner Blocker",
      trigger:
        "Contact/Company becomes Active Customer AND 'Renewal Owner' is empty",
      action:
        "Create high-priority task for CS Ops: assign Renewal Owner within 48 hours; block renewal stage progression",
      recipient: "CS Ops",
    });
  } else if (system === "salesforce") {
    specs.push({
      system,
      name: "Renewal 90-Day Flow",
      trigger: "Scheduled Flow: Opportunity.CloseDate - 90 days WHERE Type = 'Renewal'",
      action:
        "Create Task on Opportunity Owner; post Chatter to @renewal-pipeline group with health context",
      recipient: "Opportunity Owner",
    });
    specs.push({
      system,
      name: "Health Score Risk Flow",
      trigger: "Record-Triggered Flow on Account.Health_Score__c transition to < 60",
      action:
        "Create case + task for CSM; notify CSM Manager via Chatter; flag Renewal Opp as At-Risk",
      recipient: "CSM + Manager",
    });
    specs.push({
      system,
      name: "Renewal Ownership Validation",
      trigger: "Validation Rule on Account: Status = 'Customer' AND Renewal_Owner__c = null",
      action: "Block save; queue assignment task for CS Ops",
      recipient: "CS Ops",
    });
  } else {
    specs.push({
      system,
      name: "Renewal 90-Day Reminder",
      trigger: "Contract end date – 90 days",
      action: "Email + task to Renewal Owner with health score context",
      recipient: "Renewal Owner",
    });
    specs.push({
      system,
      name: "Health Score Risk Alert",
      trigger: "Health score drops below yellow threshold",
      action: "Alert Renewal Owner + Manager with intervention playbook link",
      recipient: "Renewal Owner + Manager",
    });
  }

  specs.push({
    system,
    name: "Renewal Pipeline Dashboard",
    trigger: "On-demand + weekly scheduled export",
    action:
      "Roll up all accounts with renewal date in next 120 days, grouped by Renewal Owner, ranked by ARR × health score",
    recipient: "CS Leadership + CS Ops",
  });

  return specs;
}

function buildPhases(blueprint: Blueprint, approach: Approach): Phase[] {
  const baseHours =
    approach === "cs_platform" ? 100 : approach === "hybrid" ? 80 : 60;
  const complexity = blueprint.csTeam === "mature" ? 1.2 : 1;

  return [
    {
      id: "strategy",
      name: "Phase 1 — Strategy",
      hours: [
        Math.round(baseHours * 0.25 * complexity),
        Math.round(baseHours * 0.3 * complexity),
      ],
      expectedMilestone:
        "Health score methodology + renewal process design signed off by VP CS",
      tasks: [
        {
          id: "kickoff",
          label: "Run kickoff + discovery interviews (VP CS, CS Ops, 2-3 CSMs)",
          owner: "Architect",
          hours: 6,
        },
        {
          id: "baseline",
          label: "Pull 12 months of churn + renewal data; calculate baseline GRR/NRR",
          owner: "Architect + CS Ops",
          hours: 4,
        },
        {
          id: "health-methodology",
          label: "Design health score methodology; workshop signals + weights with CS team",
          owner: "Architect",
          hours: 6,
        },
        {
          id: "signoff",
          label: "Strategic sign-off with VP CS + CS Ops",
          owner: "Architect",
          hours: 2,
        },
      ],
    },
    {
      id: "engineering",
      name: "Phase 2 — Engineering",
      hours: [
        Math.round(baseHours * 0.4 * complexity),
        Math.round(baseHours * 0.45 * complexity),
      ],
      expectedMilestone:
        "Renewal tracking, health scoring, alerts, and pipeline dashboard live in CRM",
      tasks: [
        {
          id: "crm-config",
          label:
            blueprint.crm === "salesforce"
              ? "Configure SF: Renewal Opportunity record type, Health Score formula fields, Flow Builder alerts"
              : blueprint.crm === "hubspot"
                ? "Configure HS: Deal properties, calculated Health Score, Workflows for 90/60/30 alerts"
                : "Configure renewal tracking, health score fields, and alert workflows in your CRM of record",
          owner: "Engineer",
          hours: 12,
        },
        {
          id: "integrations",
          label: "Wire health signal data sources (product usage, support, surveys)",
          owner: "Engineer",
          hours: 10,
        },
        {
          id: "dashboard",
          label: "Build renewal pipeline dashboard (90/60/30, ARR × health)",
          owner: "Engineer",
          hours: 6,
        },
        {
          id: "qa",
          label: "QA against test cohort; validate alert accuracy on 10 sample accounts",
          owner: "Engineer + CS Ops",
          hours: 4,
        },
      ],
    },
    {
      id: "enablement",
      name: "Phase 3 — Enablement",
      hours: [
        Math.round(baseHours * 0.18 * complexity),
        Math.round(baseHours * 0.22 * complexity),
      ],
      expectedMilestone:
        "CSM adoption > 90% — task completion + playbook usage on live renewals",
      tasks: [
        {
          id: "training",
          label: "Train CSMs on playbooks, talk tracks, escalation paths",
          owner: "Architect + CS Advisor",
          hours: 4,
        },
        {
          id: "pilot",
          label: "Pilot: run 5-10 live renewals through the new system with hypercare support",
          owner: "CS Team",
          hours: 6,
        },
        {
          id: "retro",
          label: "Retrospective: what worked, what needs tuning",
          owner: "Architect",
          hours: 2,
        },
      ],
    },
    {
      id: "handoff",
      name: "Phase 4 — Handoff",
      hours: [
        Math.round(baseHours * 0.08 * complexity),
        Math.round(baseHours * 0.12 * complexity),
      ],
      expectedMilestone:
        "Client-owned maintenance schedule + 90-day GRR measurement plan documented",
      tasks: [
        {
          id: "runbook",
          label: "Ship maintenance runbook: health score tuning cadence, alert thresholds, escalation matrix",
          owner: "Architect",
          hours: 3,
        },
        {
          id: "measurement",
          label: "Document 90-day measurement plan: track leading indicators (alert firing, task completion) + GRR lagging indicators",
          owner: "Architect",
          hours: 2,
        },
        {
          id: "close",
          label: "Project close: final review, success metrics baseline captured, reference ask",
          owner: "Architect",
          hours: 2,
        },
      ],
    },
  ];
}

export function generatePlan(blueprint: Blueprint): Plan {
  const impact = computeChurnImpact(blueprint);
  const { approach, rationale } = recommendApproach(blueprint);

  return {
    generatedAt: new Date().toISOString(),
    impact,
    approach,
    approachRationale: rationale,
    gaps: buildGaps(blueprint),
    healthDesign: buildHealthDesign(blueprint),
    staging: buildStaging(blueprint),
    playbooks: buildPlaybooks(blueprint),
    routingRules: buildRoutingRules(blueprint),
    automations: buildAutomations(blueprint),
    phases: buildPhases(blueprint, approach),
    successMetrics: [
      {
        metric: "Gross Revenue Retention (GRR)",
        baseline: `${impact.currentGrr}%`,
        target: `${impact.projectedGrr}% within 2 renewal cycles`,
      },
      {
        metric: "Surprise churn rate",
        baseline: `${impact.currentSurpriseChurn}%`,
        target: `< ${impact.projectedSurpriseChurn}%`,
      },
      {
        metric: "Renewal visibility window",
        baseline: "0-30 days (reactive)",
        target: "90 days forward visibility",
      },
      {
        metric: "Renewal ownership coverage",
        baseline: "Partial",
        target: "100% (required field)",
      },
      {
        metric: "CSM time on renewal admin",
        baseline: "3-5 hrs/week manual",
        target: "< 1 hr/week",
      },
      {
        metric: "Health score accuracy",
        baseline: "N/A",
        target: "> 80% of flagged at-risk accounts churn or require intervention",
      },
    ],
  };
}
