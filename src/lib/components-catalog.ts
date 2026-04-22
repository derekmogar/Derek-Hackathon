import type { SystemComponent } from "./types";

/**
 * The renewal management system, decomposed into 18 components across
 * 5 layers. Each component has its own diagnostic panel, maturity scale,
 * and churn-impact weight.
 *
 * Source: LeanScale Renewal Management playbook (Advisory + Methodology
 * docs), mapped to the system layers a CS operator would recognize.
 */
const COMPONENT_DEFINITIONS: SystemComponent[] = [
  /* =============== REPORTING =============== */
  {
    id: "pipeline_dashboard",
    layer: "reporting",
    name: "Renewal Pipeline Dashboard",
    shortDescription: "90-day forward view, all accounts, by owner + health",
    description:
      "The single source of truth for upcoming renewals. Shows every account with a contract end date in the next 90 days, grouped by renewal owner, ranked by ARR × health score. Weekly review cadence with CS leadership.",
    whyItMatters:
      "Without forward visibility, renewals are discovered at invoice time — already too late. Every week of lead time is worth 0.3-0.5pp GRR in intervention opportunity.",
    impactWeight: 0.6,
    benchmark:
      "Top-quartile CS orgs review pipeline weekly. Median orgs have no pipeline dashboard.",
    maturityDefinitions: {
      0: "No pipeline view — renewals surface ad-hoc when the invoice is due.",
      1: "Spreadsheet maintained manually, frequently stale.",
      2: "CRM report exists but no scheduled review cadence.",
      3: "Automated dashboard with weekly CS leadership review.",
      4: "Real-time dashboard with drill-down, executive rollup, and AI-driven forecast accuracy tracking.",
    },
    diagnosticQuestions: [
      "Where does your team look to see all renewals in the next 90 days?",
      "How often is that view refreshed?",
      "Who attends the weekly pipeline review?",
    ],
    recommendedAction:
      "Build a CRM report: Accounts WHERE ContractEndDate in [TODAY, TODAY+90], columns = Owner, ARR, Health, Stage. Schedule weekly 30-min review with VP CS and CSM leads.",
    playbookExcerpt:
      "\"90-day forward visibility with automated alerts\" is the #1 before→after transformation in the Renewal Management playbook.",
    croFraming:
      "Right now you can't see what's renewing 90 days out. That's where churn hides.",
  },
  {
    id: "risk_report",
    layer: "reporting",
    name: "Risk Report",
    shortDescription: "At-risk accounts with reason codes + save status",
    description:
      "Weekly risk report listing every account with a yellow/red health score, the reason code, the save motion in progress, and the last touchpoint. Shared with CS leadership + RevOps.",
    whyItMatters:
      "Surfaces at-risk accounts before they churn. Without this report, save plays happen reactively — after the customer has already decided to leave.",
    impactWeight: 0.8,
    dependencies: ["health_engine"],
    benchmark:
      "80%+ of churned accounts should have been flagged in a risk report at least 30 days prior.",
    maturityDefinitions: {
      0: "No risk report — at-risk accounts only surface through CSM instinct.",
      1: "Manual list updated sporadically.",
      2: "Report exists, reviewed irregularly.",
      3: "Weekly automated report with reason codes and save status.",
      4: "Risk report integrated with save-play automation and executive escalation flow.",
    },
    diagnosticQuestions: [
      "Who gets notified when an account turns yellow or red?",
      "How do you track save motions currently in progress?",
      "What was the last surprise churn you had — was it on any risk list?",
    ],
    recommendedAction:
      "Build a filtered view: Accounts WHERE Health = Yellow OR Red, columns = Owner, ARR, Health, Last Touchpoint, Risk Reason, Save Motion Status. Review Thursdays with VP CS.",
    playbookExcerpt:
      "Surprise churn (no prior risk flag) should drop from 30-50% of churned accounts to under 5% once health scoring + risk reporting is in place.",
    croFraming:
      "When an account churns without warning, it means your risk report doesn't exist yet.",
  },
  {
    id: "forecast_accuracy",
    layer: "reporting",
    name: "Forecast Accuracy Tracking",
    shortDescription: "Pipeline commit vs. actuals, variance analysis",
    description:
      "Tracks renewal forecast vs. actual close each month. Drives forecast discipline and board-level retention reporting. Feeds CS capacity planning and territory design.",
    whyItMatters:
      "An inaccurate renewal forecast makes the CS team invisible to Finance and the Board. Accuracy within 5% unlocks budget and headcount credibility.",
    impactWeight: 0.3,
    dependencies: ["pipeline_dashboard"],
    benchmark: "Top-performing CS orgs forecast renewals within 5% accuracy.",
    maturityDefinitions: {
      0: "No forecast — 'renewals happen.'",
      1: "Top-of-head forecast from CS leader.",
      2: "Commit/best/worst categorization in a spreadsheet.",
      3: "CRM-driven weighted pipeline with monthly variance review.",
      4: "AI-assisted forecast incorporating health scores + historical renewal patterns.",
    },
    diagnosticQuestions: [
      "What did Finance forecast for renewals last quarter — was it right?",
      "How do you weight renewal probability today?",
      "Who owns the renewal forecast number?",
    ],
    recommendedAction:
      "Add Renewal Probability field (25/50/75/90%) to each renewal Opp. Report monthly: Forecast Amount × Probability vs. Closed Won.",
    playbookExcerpt:
      "Accurate renewal forecasting is a secondary outcome of this project — the infrastructure that enables predictable CS budgeting.",
    croFraming:
      "The board wants a reliable number. Your forecast should be within 5%.",
  },

  /* =============== AUTOMATION =============== */
  {
    id: "alerts_906030",
    layer: "automation",
    name: "90/60/30 Alert Engine",
    shortDescription: "Staged CRM alerts + tasks at each intervention window",
    description:
      "Automated alerts fire 90, 60, and 30 days before each contract end date with a specific CSM action at each stage. Escalation paths to managers if tasks go stale. Context-rich — every alert includes current health score + last touchpoint.",
    whyItMatters:
      "Staged cadence creates the intervention windows CSMs need. Without alerts, renewals are discovered reactively. This is the single biggest lift in converting a spreadsheet process into a system.",
    impactWeight: 1.6,
    dependencies: ["contract_data", "renewal_ownership"],
    benchmark:
      "Automated 90/60/30 alerts should fire on 100% of active customers. Task SLA: 48 hours.",
    maturityDefinitions: {
      0: "No alerts — renewals discovered by chance or at invoice time.",
      1: "Calendar reminders or ad-hoc CSM follow-up.",
      2: "Documented cadence that CSMs execute manually.",
      3: "CRM workflow fires tasks with health-score context; manager escalation after SLA.",
      4: "Alerts are fully contextualized (health + usage + support state); task completion tracked against SLA.",
    },
    diagnosticQuestions: [
      "What happens in your system exactly 90 days before a contract ends?",
      "What happens at 60 days? At 30?",
      "Who gets notified if a CSM misses a renewal task?",
    ],
    recommendedAction:
      "Build 3 CRM workflows (Hubspot: Workflow / SF: Flow). Trigger: ContractEndDate - 90/60/30 days. Action: create task on Renewal Owner + post to #renewal-pipeline Slack channel with health context.",
    playbookExcerpt:
      "The 90/60/30-day cadence is the forecast window: 90 days out you see the system forming, 60 days you track its path, 30 days you execute the response plan.",
    croFraming:
      "Today your CSMs find out about renewals at the last minute. Staged alerts give them 90 days of lead time.",
  },
  {
    id: "health_engine",
    layer: "automation",
    name: "Health Score Engine",
    shortDescription: "Weighted composite score with risk thresholds",
    description:
      "A weighted composite health score combining product usage (30%), engagement (20%), CSM pulse (15%), support signals (15%), NPS (10%), and billing signals (10%). Recalculated nightly. Green / yellow / red thresholds drive intervention routing.",
    whyItMatters:
      "Health scoring is the single highest-leverage signal in retention. It identifies at-risk accounts 3-6 months before churn — the lead time CSMs need to run save plays that actually work.",
    impactWeight: 2.2,
    dependencies: ["usage_data", "support_data", "engagement_data"],
    benchmark:
      "AI/rules-based health scores predict churn with 85%+ accuracy 3-6 months out (Gainsight research).",
    maturityDefinitions: {
      0: "No health score — risk is CSM intuition only.",
      1: "CSMs self-report account health weekly in CRM.",
      2: "Rules-based score (formula field) with 3-4 inputs.",
      3: "Multi-signal weighted score, updated nightly, drives alerts.",
      4: "ML-driven score trained on historical churn with drift monitoring.",
    },
    diagnosticQuestions: [
      "How do you know today that an account is at risk?",
      "What inputs feed that judgment?",
      "How far in advance can you predict a churn?",
    ],
    recommendedAction:
      "Phase 1: Build rules-based score using usage (30%) + engagement (20%) + CSM pulse (15%) + support (15%) + NPS (10%) + billing (10%). Thresholds: ≥80 green, 60-79 yellow, <60 red.",
    playbookExcerpt:
      "CSM intuition does not scale past 30 accounts. Health scores give CSMs X-ray vision — the data behind the gut feeling.",
    croFraming:
      "Your best CSMs can feel when an account is slipping. A health score lets every CSM do it across every account.",
  },
  {
    id: "routing_engine",
    layer: "automation",
    name: "Routing & Escalation Engine",
    shortDescription: "Automated CSM assignment + manager escalation paths",
    description:
      "Rule-based routing that assigns a renewal owner on every new customer, enforces coverage ratios, and escalates to managers when SLAs are missed. No unowned renewals — ever.",
    whyItMatters:
      "Unowned renewals are the single most preventable source of churn. Automated routing turns 'we forgot who owned that' into zero.",
    impactWeight: 1.0,
    dependencies: ["renewal_ownership"],
    benchmark: "100% renewal ownership coverage; no account should be unassigned.",
    maturityDefinitions: {
      0: "Renewal owner often blank or out-of-date.",
      1: "Ownership assigned case-by-case by CS leader.",
      2: "Territory rules documented, enforced manually.",
      3: "Automated assignment at customer onboarding + on account changes.",
      4: "Dynamic rebalancing based on CSM capacity + account risk.",
    },
    diagnosticQuestions: [
      "When a new customer comes aboard, when do they get a renewal owner?",
      "What's your CSM-to-account coverage ratio today?",
      "What happens when a renewal owner leaves the company?",
    ],
    recommendedAction:
      "Validation rule: Status = Customer requires Renewal_Owner. Build assignment rules by segment (Enterprise / Mid / SMB).",
    playbookExcerpt:
      "Every renewal assigned an owner with required accountability is in the top 3 before→after transformations.",
    croFraming: "If a CSM quits tomorrow, do you know whose accounts need a new owner?",
  },
  {
    id: "save_trigger",
    layer: "automation",
    name: "Save-Play Trigger",
    shortDescription: "Auto-launch save motion when health turns red",
    description:
      "When a health score drops below the red threshold or a risk signal fires (exec sponsor leaves, seat reduction, usage cliff), the save-play trigger automatically creates a save motion task, notifies the manager, and requires root-cause coding.",
    whyItMatters:
      "Converts reactive 'we lost them' into proactive save plays. Industry data shows 20-40% of at-risk accounts can be saved when intervention happens early.",
    impactWeight: 1.2,
    dependencies: ["health_engine", "save_playbook"],
    benchmark:
      "Top CS orgs intervene within 48 hours of health-score decline and save 20-40% of at-risk ARR.",
    maturityDefinitions: {
      0: "No trigger — saves happen (or don't) based on CSM memory.",
      1: "Manual save motion when CSM notices.",
      2: "Save motion documented but triggered manually.",
      3: "Automated trigger on health change + task creation.",
      4: "Trigger includes root-cause coding, VP CS approval for concessions, outcome tracking (saved / downgraded / churned).",
    },
    diagnosticQuestions: [
      "What happens in your system when an account's health drops?",
      "How do you track save motions in progress?",
      "What's your save rate — and how do you know?",
    ],
    recommendedAction:
      "Record-triggered flow: Health changes to Red → create Case + assign to Renewal Owner + notify Manager in Slack with playbook link.",
    playbookExcerpt:
      "A documented intervention script with executive escalation authority converts 20-40% of at-risk accounts that would otherwise churn.",
    croFraming:
      "Every at-risk account should trigger a save motion automatically. Not when someone remembers.",
  },

  /* =============== PROCESS =============== */
  {
    id: "auto_renewal",
    layer: "process",
    name: "Auto-Renewal Motion",
    shortDescription: "Silent renewal flow for healthy accounts",
    description:
      "Healthy accounts renew silently — invoice issued, payment received, contract extended. CSM review only triggered if health drops. Frees CSM capacity for at-risk and expansion work.",
    whyItMatters:
      "Takes administrative renewals off CSM plates so they can focus on the 20% of accounts that need attention.",
    impactWeight: 0.3,
    nrrWeight: 0.2,
    dependencies: ["health_engine", "alerts_906030"],
    benchmark:
      "Mature CS orgs auto-renew 60-70% of accounts silently, reserving CSM time for exception paths.",
    maturityDefinitions: {
      0: "Every renewal treated the same — CSM touch required.",
      1: "Ad-hoc: some accounts renew quietly, others get full CSM attention.",
      2: "Documented rules for auto-renewal eligibility.",
      3: "Automated flow: invoice issued + contract extended if health = green and no escalation.",
      4: "Auto-renewal includes proactive value-prove (usage highlights emailed, NPS captured) before silent close.",
    },
    diagnosticQuestions: [
      "How many of your renewals actually need a CSM conversation?",
      "What's your process for a 'quiet' renewal?",
      "How do you tell finance which accounts are auto-renewing?",
    ],
    recommendedAction:
      "Define auto-renewal criteria (health = green, no open escalations, ARR < $X). Build workflow to auto-issue invoice + auto-extend.",
    playbookExcerpt:
      "Auto-renewal of healthy accounts frees CSM capacity for at-risk and expansion work.",
    croFraming:
      "Your CSMs spend time on renewals that don't need them. Free them up to focus on the ones that do.",
  },
  {
    id: "expansion_motion",
    layer: "process",
    name: "Expansion Motion",
    shortDescription: "Upsell / cross-sell conversations at renewal",
    description:
      "The renewal window is the highest-signal moment for expansion. This motion identifies expansion candidates (usage growth, new product fit, exec engagement), runs a joint CSM + AE discovery, and packages multi-year / higher-tier / module add-on options.",
    whyItMatters:
      "Drives NRR above 100% — the difference between a growing and a stagnating CS function. Every renewal conversation should surface expansion; most orgs leave NRR on the table.",
    impactWeight: 0.4,
    nrrWeight: 2.5,
    dependencies: ["usage_data", "csm_ae_collab"],
    benchmark: "Best-in-class SaaS NRR: 120%+. Median: 100-105%.",
    maturityDefinitions: {
      0: "Renewal and expansion are separate unrelated motions.",
      1: "CSMs occasionally flag expansion to AEs.",
      2: "Expansion qualified during renewal conversations.",
      3: "Systematic expansion motion with AE handoff at defined triggers.",
      4: "Expansion bundled into the renewal deal with data-driven sizing.",
    },
    diagnosticQuestions: [
      "When does your team talk expansion — at renewal, or separately?",
      "How do you identify expansion candidates?",
      "Who owns expansion revenue — CSM or AE?",
    ],
    recommendedAction:
      "Add 'Expansion Identified' field on Renewal Opp. Trigger: Usage growth > 30% YoY OR new product feature adopted → task to CSM to run expansion discovery.",
    playbookExcerpt:
      "Renewal conversations surface expansion opportunities — the secondary outcome that drives NRR from 100% to 110%+.",
    croFraming:
      "Every renewal is a chance to grow that account. You're probably missing half of them.",
  },
  {
    id: "early_renewal",
    layer: "process",
    name: "Early Renewal Motion",
    shortDescription: "Lock in healthy accounts before the window opens",
    description:
      "Strategic lock-in of top-decile healthy accounts 3-6 months before renewal. Trade concessions (1-2 months free, locked pricing, multi-year discount) for certainty. Removes re-evaluation risk.",
    whyItMatters:
      "Removes timing risk and compresses sales cycle on your best accounts. Typically executed on 5-10% of the base.",
    impactWeight: 0.2,
    nrrWeight: 0.4,
    dependencies: ["health_engine"],
    benchmark:
      "Top-performing CS orgs early-renew 5-10% of base each quarter, capturing multi-year commitments on their healthiest accounts.",
    maturityDefinitions: {
      0: "No early renewal motion.",
      1: "Occasionally pursued when a rep notices.",
      2: "Documented trigger but executed case-by-case.",
      3: "Systematic: top-decile health accounts identified and approached 3-6 mo out.",
      4: "Early renewal includes multi-year incentive framework + exec-sponsor engagement.",
    },
    diagnosticQuestions: [
      "When was your last early renewal?",
      "What made it happen?",
      "Would you target 5% of your base for early renewal next quarter?",
    ],
    recommendedAction:
      "Build quarterly early-renewal list: health ≥ 90, ARR > $50K, 6+ months remaining. VP CS + AE run exec meetings to propose early lock-in.",
    playbookExcerpt:
      "Lock in highly healthy accounts early in exchange for term or volume commitment.",
    croFraming: "Your best accounts shouldn't be waiting to renew. Lock them in early.",
  },
  {
    id: "save_playbook",
    layer: "process",
    name: "Churn Save Playbook",
    shortDescription: "Documented save motion with escalation authority",
    description:
      "Standard save motion: root-cause discovery → save package (concession authority, success plan, exec escalation) → VP CS approval for concessions above threshold → tracked outcome. Every at-risk account runs the same play.",
    whyItMatters:
      "Save outcomes depend entirely on whether the CSM has a script + authority. Without a playbook, saves depend on who you get.",
    impactWeight: 1.5,
    dependencies: ["save_trigger", "escalation_matrix"],
    benchmark: "Documented save playbooks save 20-40% of at-risk ARR.",
    maturityDefinitions: {
      0: "No documented save motion.",
      1: "CSM improvises based on experience.",
      2: "Playbook documented but enforcement inconsistent.",
      3: "Playbook with clear steps + concession authority + outcome tracking.",
      4: "Save playbook A/B tested with win-rate analytics by root cause.",
    },
    diagnosticQuestions: [
      "When a CSM identifies churn risk, what do they do next?",
      "Who approves a save discount?",
      "How do you learn from saves that don't work?",
    ],
    recommendedAction:
      "Document 5-step save motion: (1) discovery call, (2) root-cause coding, (3) save package, (4) exec escalation if ARR > threshold, (5) outcome tracking.",
    playbookExcerpt:
      "A documented intervention script with executive escalation authority converts 20-40% of at-risk accounts.",
    croFraming:
      "When a big account tells you they're thinking of leaving, there should be a playbook — not a scramble.",
  },

  /* =============== DATA =============== */
  {
    id: "contract_data",
    layer: "data",
    name: "Contract Data Integrity",
    shortDescription: "End dates, ARR, auto-renewal clauses — in the CRM",
    description:
      "Every active customer has accurate ContractEndDate, ARR, contract type, and auto-renewal clause captured in the CRM. This is the foundation for everything above.",
    whyItMatters:
      "Without accurate contract end dates, no automation works. This is the floor — you can't do staging, health, or alerts without it.",
    impactWeight: 0.8,
    benchmark:
      "100% of active customers should have populated ContractEndDate, ARR, and contract type.",
    maturityDefinitions: {
      0: "Contract dates missing or stored in DocuSign only.",
      1: "Partial data — Enterprise accounts tracked, others inconsistent.",
      2: "All accounts have dates but manual entry introduces drift.",
      3: "Billing system ↔ CRM sync keeps contract data current.",
      4: "Contract data + renewal terms versioned, auditable, and feeds forecast automatically.",
    },
    diagnosticQuestions: [
      "What % of your active customers have a contract end date in the CRM?",
      "When was the last audit of contract data?",
      "What's the source of truth — billing or CRM?",
    ],
    recommendedAction:
      "Audit active customers; backfill missing ContractEndDate, ARR, ContractType from billing system. Set up nightly sync.",
    playbookExcerpt:
      "Complete contract data (end date, ARR, contract type, auto-renewal clauses) must be populated before any automation can run.",
    croFraming:
      "If your CRM doesn't know when your contracts end, nothing downstream can work.",
  },
  {
    id: "usage_data",
    layer: "data",
    name: "Product Usage Signals",
    shortDescription: "Login frequency, feature adoption, seat utilization",
    description:
      "Product usage data flowing into the CRM: login frequency, feature adoption trends, seat utilization, API call volume. Feeds the health score and identifies expansion candidates.",
    whyItMatters:
      "The strongest leading indicator of churn. Declining usage precedes cancellation by 3-6 months — if you can see it.",
    impactWeight: 0.7,
    nrrWeight: 0.3,
    benchmark:
      "Usage data should contribute 25-40% of the health score weight.",
    maturityDefinitions: {
      0: "Usage data lives in the product only — CSMs can't see it.",
      1: "CSMs pull usage reports ad-hoc.",
      2: "Weekly usage digests to CSMs.",
      3: "Usage data piped into CRM as properties, feeds health score.",
      4: "Real-time usage with cohort benchmarking and anomaly detection.",
    },
    diagnosticQuestions: [
      "What usage data do your CSMs see in the CRM?",
      "Can you tell which accounts' usage is declining?",
      "What tool generates product usage analytics today?",
    ],
    recommendedAction:
      "Pipe daily usage aggregates (logins, active users, key feature adoption) from Pendo/Mixpanel/Segment into CRM. Build usage_trend_30d property.",
    playbookExcerpt:
      "Product usage analytics is the single most predictive health score input — declining usage precedes churn by 3-6 months.",
    croFraming:
      "You can see who's paying you. Can you see who's using you?",
  },
  {
    id: "support_data",
    layer: "data",
    name: "Support + CSAT Signals",
    shortDescription: "Ticket volume, sentiment, CSAT trend",
    description:
      "Support ticket volume, severity, sentiment, and CSAT feeding into the health score. High-severity or rapid ticket volume spikes are leading churn indicators.",
    whyItMatters:
      "Customers churn after bad support experiences. Integrating support into the health score catches this early.",
    impactWeight: 0.4,
    benchmark:
      "Support signals should contribute 10-20% of health score weight.",
    maturityDefinitions: {
      0: "Support tickets invisible to CS team.",
      1: "CSMs ask support for escalation lists.",
      2: "Weekly support-CS sync meeting.",
      3: "Support data piped into CRM, feeds health score.",
      4: "Real-time sentiment analysis + deflection metrics feeding risk scoring.",
    },
    diagnosticQuestions: [
      "How does your CSM find out about a bad support experience?",
      "What's your CSAT trend over the last 6 months?",
      "Can you pull up an account's support history in the CRM?",
    ],
    recommendedAction:
      "Integrate Zendesk/Intercom/HubSpot Service ticket counts + CSAT trends into CRM account records.",
    playbookExcerpt:
      "Support ticket volume + sentiment is a fast-moving churn signal; include as 10-20% of health score weight.",
    croFraming:
      "A customer who's had a bad week in support isn't a customer renewing next quarter.",
  },
  {
    id: "engagement_data",
    layer: "data",
    name: "Engagement History",
    shortDescription: "QBR cadence, exec sponsor, meeting frequency",
    description:
      "Engagement data: last QBR date, executive sponsor presence, meeting cadence, email engagement. Disengaged accounts churn; engagement is the relational counterpart to product usage.",
    whyItMatters:
      "Accounts without active CSM engagement churn at 2-3× the rate of engaged ones. If the exec sponsor leaves, the clock starts.",
    impactWeight: 0.5,
    benchmark:
      "Every managed account should have documented QBR within last 90 days and identified exec sponsor.",
    maturityDefinitions: {
      0: "No tracking of CSM touchpoints.",
      1: "CSMs log meetings inconsistently.",
      2: "Meeting notes in CRM; sponsor tracked manually.",
      3: "Activity auto-captured; QBR cadence enforced; exec-sponsor-leaves alerts.",
      4: "Relationship graph tracks multiple sponsors + champions + detractors with turnover alerts.",
    },
    diagnosticQuestions: [
      "How many of your accounts had a QBR in the last 90 days?",
      "Who is the exec sponsor on your top 10 accounts?",
      "What happens if that person leaves?",
    ],
    recommendedAction:
      "Add CRM fields: Exec_Sponsor, Last_QBR, Next_QBR. Build workflow: Exec_Sponsor_Leaves → Yellow health trigger.",
    playbookExcerpt:
      "Engagement data — QBR cadence, exec sponsor coverage — contributes 15-25% of health score weight.",
    croFraming:
      "When your champion at the customer leaves, you need to know within a week. Not when the renewal comes up.",
  },

  /* =============== TEAM =============== */
  {
    id: "renewal_ownership",
    layer: "team",
    name: "Renewal Ownership Model",
    shortDescription: "Every account has a required renewal owner",
    description:
      "Renewal ownership is a required CRM field, enforced by validation rule. No active customer can exist without one. Ownership model is documented (named CSM / pooled CSM / shared).",
    whyItMatters:
      "Unowned renewals are the single most preventable source of churn.",
    impactWeight: 1.0,
    benchmark: "100% renewal ownership coverage on active customers.",
    maturityDefinitions: {
      0: "Renewal owner field missing or frequently blank.",
      1: "Ownership tracked in a spreadsheet.",
      2: "CRM field exists; populated inconsistently.",
      3: "Required field with validation rule; 100% coverage.",
      4: "Ownership model includes backup owner, coverage ratio limits, and reassignment automation.",
    },
    diagnosticQuestions: [
      "What % of your customer accounts have a renewal owner today?",
      "Where is that recorded?",
      "Is it enforced?",
    ],
    recommendedAction:
      "Add Renewal_Owner field (if not present). Validation rule: Status = Customer requires Renewal_Owner. Backfill existing customers.",
    playbookExcerpt:
      "Every renewal assigned an owner with required accountability — #1 ownership gap closed.",
    croFraming:
      "If you can't point to one person who owns a renewal, that renewal is at risk.",
  },
  {
    id: "csm_routing",
    layer: "team",
    name: "CSM Tiering & Coverage Ratios",
    shortDescription: "Named-account model with coverage caps",
    description:
      "Tiered CSM model: Enterprise (named, < 40 accounts/CSM), Mid-Market (named, < 80 accounts/CSM), SMB (pooled queue). Coverage ratios enforced. Named accounts drive retention; pooled queue drives scale.",
    whyItMatters:
      "CSM coverage ratio is a leading indicator of retention. Over 80 accounts/CSM, churn accelerates because CSMs can't stay ahead of risk.",
    impactWeight: 0.6,
    benchmark:
      "Best-in-class: Enterprise CSMs cap at 25-40 accounts; Mid at 60-80; SMB pooled.",
    maturityDefinitions: {
      0: "No tiering — CSMs split accounts randomly.",
      1: "Informal Enterprise vs. SMB distinction.",
      2: "Documented tiers but ratios exceed benchmarks.",
      3: "Tiered model enforced; coverage caps respected.",
      4: "Dynamic tiering: accounts move tiers based on ARR growth + health; capacity rebalanced quarterly.",
    },
    diagnosticQuestions: [
      "How many accounts does your busiest CSM carry?",
      "What tier is each account — Enterprise, Mid, SMB?",
      "Who covers SMB accounts?",
    ],
    recommendedAction:
      "Document tier thresholds by ARR. Build coverage-ratio report. Rebalance on first quarter after hire.",
    playbookExcerpt:
      "Tiered named-account models with enforced coverage ratios are core to retention at scale.",
    croFraming:
      "Your busiest CSM probably has 120 accounts. They can't retain that many.",
  },
  {
    id: "escalation_matrix",
    layer: "team",
    name: "Escalation Matrix",
    shortDescription: "Who approves save concessions, at what threshold",
    description:
      "Documented escalation matrix: CSM can offer X, Manager can approve Y, VP CS approves Z, CRO approves above. Authority thresholds by concession type and ARR.",
    whyItMatters:
      "Save motions stall without clear concession authority. An escalation matrix removes the 'let me check' moment that loses deals.",
    impactWeight: 0.5,
    dependencies: ["save_playbook"],
    benchmark:
      "Top CS orgs document concession authority in a single-page matrix every CSM knows.",
    maturityDefinitions: {
      0: "No documented authority — every concession needs VP approval.",
      1: "Informal rules of thumb.",
      2: "Documented but not enforced.",
      3: "Clear matrix published; CSMs empowered to act.",
      4: "Matrix enforced through CRM workflow + automated approval routing.",
    },
    diagnosticQuestions: [
      "If a CSM needs to offer a 10% discount to save an account, what do they do?",
      "Who approves a 20% discount? 40%?",
      "How long does that take today?",
    ],
    recommendedAction:
      "Build single-page escalation matrix: CSM ≤ 5% discount / 1 mo extension | Mgr ≤ 15% / 3 mo | VP CS ≤ 25% / 6 mo | CRO: anything above.",
    playbookExcerpt:
      "Without concession authority, save motions stall at the most expensive moment.",
    croFraming:
      "Your team shouldn't have to call you for every save. Give them authority and a matrix.",
  },
  {
    id: "csm_ae_collab",
    layer: "team",
    name: "CSM ↔ AE Collaboration Model",
    shortDescription: "Shared ownership on expansion and save motions",
    description:
      "CSM owns renewal; AE supports expansion and high-value saves. Documented handoff triggers, shared commission plan on expansion, joint QBR attendance for Enterprise accounts.",
    whyItMatters:
      "Expansion revenue lives in the gap between CSM and AE. Without a collaboration model, both sides assume the other owns it — and NRR suffers.",
    impactWeight: 0.3,
    nrrWeight: 1.2,
    dependencies: ["expansion_motion"],
    benchmark:
      "Orgs with formal CSM-AE expansion collab grow NRR 8-12pp faster than those without.",
    maturityDefinitions: {
      0: "CSMs and AEs don't coordinate on accounts.",
      1: "Ad-hoc coordination when CSM flags opportunity.",
      2: "Documented handoff but inconsistent execution.",
      3: "Formal model: joint QBRs on Enterprise, shared comp on expansion.",
      4: "Pod model: CSM + AE + Solutions Engineer operate as a unit per account.",
    },
    diagnosticQuestions: [
      "When does your AE get involved in a renewal?",
      "Who owns expansion commission?",
      "Does your AE attend QBRs?",
    ],
    recommendedAction:
      "Document handoff triggers (usage growth > 30% → AE joins; red health on Enterprise → AE joins). Share expansion commission 50/50.",
    playbookExcerpt:
      "Expansion revenue lives in the CSM ↔ AE gap. Close it with a documented model and aligned incentives.",
    croFraming:
      "Your AEs and CSMs should operate as a team on your biggest accounts.",
  },
];

/** Display order for the discovery flow — highest churn-reduction impact first.
 *  Reporting components land at the end (Derek's ask: these are visibility layers
 *  that depend on the other layers being built first). */
const DISPLAY_ORDER: string[] = [
  // Process + automation — the biggest levers
  "health_engine",
  "expansion_motion",
  "alerts_906030",
  "save_playbook",
  "save_trigger",
  "routing_engine",
  "renewal_ownership",
  "csm_ae_collab",
  "usage_data",
  "contract_data",
  "csm_routing",
  "engagement_data",
  "escalation_matrix",
  "auto_renewal",
  "early_renewal",
  "support_data",
  // Reporting — last
  "risk_report",
  "pipeline_dashboard",
  "forecast_accuracy",
];

export const SYSTEM_COMPONENTS: SystemComponent[] = DISPLAY_ORDER.map(
  (id) => COMPONENT_DEFINITIONS.find((c) => c.id === id),
).filter((c): c is SystemComponent => !!c);

export const COMPONENT_INDEX: Record<string, SystemComponent> = Object.fromEntries(
  COMPONENT_DEFINITIONS.map((c) => [c.id, c]),
);
