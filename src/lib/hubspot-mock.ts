import type { Maturity, SystemContext } from "./types";

/**
 * Mocked "scan" result from a HubSpot portal for a typical mid-market
 * SaaS customer. Used to demonstrate the integration flow — populates
 * context + a realistic starting state for the canvas.
 *
 * In production, this would come from HubSpot API calls against the
 * portal, inferring maturity from: workflow count, deal properties,
 * custom properties, scheduled reports, pipeline stages, and integrations.
 */
export type HubSpotScanResult = {
  portal: string;
  scannedAt: string;
  findings: {
    workflows: number;
    renewalWorkflows: number;
    dealProperties: number;
    customObjects: number;
    pipelineStages: string[];
    integrations: string[];
  };
  context: SystemContext;
  componentMaturity: Record<string, Maturity>;
  detectedGaps: string[];
};

export const MOCK_HUBSPOT_SCAN: HubSpotScanResult = {
  portal: "acme-saas-main (HubID 12847392)",
  scannedAt: new Date().toISOString(),
  findings: {
    workflows: 47,
    renewalWorkflows: 2,
    dealProperties: 18,
    customObjects: 0,
    pipelineStages: [
      "Trial",
      "Active Subscription",
      "At-Risk",
      "Renewed",
      "Churned",
    ],
    integrations: ["Stripe", "Zendesk", "Slack", "Intercom"],
  },
  context: {
    accountCount: "50_200",
    arrBand: "5_10m",
    crm: "hubspot",
    currentGrr: 87,
  },
  componentMaturity: {
    // Reporting: weak
    pipeline_dashboard: 1, // ad-hoc — one static report, no review cadence
    risk_report: 0, // missing
    forecast_accuracy: 1,

    // Automation: partial
    alerts_906030: 1, // only 2 renewal workflows detected, no 90/60/30 staging
    health_engine: 0, // no health score property found
    routing_engine: 1, // some assignment rules
    save_trigger: 0, // missing

    // Process: some in place
    auto_renewal: 2, // documented, not automated
    expansion_motion: 1,
    early_renewal: 0,
    save_playbook: 1,

    // Data: mixed
    contract_data: 2, // ContractEndDate exists on most deals
    usage_data: 0, // no usage integration detected
    support_data: 2, // Zendesk + Intercom connected
    engagement_data: 2, // activity history reasonable

    // Team: weak
    renewal_ownership: 1, // assigned on ~60% of customers
    csm_routing: 1, // informal tiering
    escalation_matrix: 0, // not documented in playbook library
    csm_ae_collab: 1,
  },
  detectedGaps: [
    "No Health Score property on Company object — missing churn early-warning",
    "Only 2 renewal workflows found (expected 90/60/30 triad)",
    "No usage data integration — Pendo/Mixpanel not connected",
    "~40% of active customers missing Renewal Owner",
    "No documented Save Playbook in knowledge base",
  ],
};
