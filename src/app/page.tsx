"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import {
  computeChurnImpact,
  findBrokenChains,
  formatCurrency,
  rankGaps,
} from "@/lib/churnImpact";
import {
  COMPONENT_INDEX,
  SYSTEM_COMPONENTS,
} from "@/lib/components-catalog";
import { MOCK_HUBSPOT_SCAN } from "@/lib/hubspot-mock";
import { generatePlan } from "@/lib/planGenerator";
import {
  emptySystemState,
  LAYER_LABELS,
  LAYER_ORDER,
  MATURITY_LABELS,
  type Maturity,
  type Mode,
  type Plan,
  type SystemState,
} from "@/lib/types";
import styles from "./page.module.css";

const STORAGE_KEY = "retention-engine:v2";

export default function Home() {
  const [state, setState] = useState<SystemState>(emptySystemState);
  const [activeComponentId, setActiveComponentId] = useState<string | null>(null);
  const [showConnect, setShowConnect] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [loadedFromStorage, setLoadedFromStorage] = useState(false);

  // Load from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as SystemState;
        setState({ ...emptySystemState, ...parsed });
      }
    } catch {
      // ignore
    }
    setLoadedFromStorage(true);
  }, []);

  // Persist
  useEffect(() => {
    if (!loadedFromStorage) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, loadedFromStorage]);

  const impact = useMemo(() => computeChurnImpact(state), [state]);
  const brokenChains = useMemo(() => findBrokenChains(state), [state]);
  const plan: Plan | null = useMemo(
    () => (state.view !== "canvas" ? generatePlan(state) : null),
    [state],
  );

  const componentsSetCount = Object.values(state.components).filter(
    (m) => m > 0,
  ).length;

  const setMaturity = (id: string, maturity: Maturity) => {
    setState((prev) => ({
      ...prev,
      components: { ...prev.components, [id]: maturity },
    }));
  };

  const setNote = (id: string, note: string) => {
    setState((prev) => ({
      ...prev,
      notes: { ...prev.notes, [id]: note },
    }));
  };

  const setMode = (mode: Mode) => setState((p) => ({ ...p, mode }));
  const setView = (view: SystemState["view"]) =>
    setState((p) => ({ ...p, view }));
  const updateContext = <K extends keyof SystemState["context"]>(
    key: K,
    value: SystemState["context"][K],
  ) => setState((p) => ({ ...p, context: { ...p.context, [key]: value } }));

  const runConnect = async () => {
    setShowConnect(true);
    setScanning(true);
    await new Promise((r) => setTimeout(r, 2400));
    setState((prev) => ({
      ...prev,
      context: { ...prev.context, ...MOCK_HUBSPOT_SCAN.context },
      components: { ...prev.components, ...MOCK_HUBSPOT_SCAN.componentMaturity },
      connected: true,
      connectedAt: new Date().toISOString(),
      mode: prev.mode === "architect" ? "integration" : prev.mode,
    }));
    setScanning(false);
  };

  const resetAll = () => {
    if (!confirm("Reset the canvas to a blank state?")) return;
    localStorage.removeItem(STORAGE_KEY);
    setState(emptySystemState);
    setActiveComponentId(null);
  };

  const openPlan = () => setView("plan");
  const goBuild = () => setView("build");
  const goComplete = () => {
    setView("complete");
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 4000);
  };

  const activeComponent = activeComponentId ? COMPONENT_INDEX[activeComponentId] : null;

  const allTasks = plan ? plan.phases.flatMap((p) => p.tasks.map((t) => t.id)) : [];
  const doneCount = allTasks.filter((id) => state.tasksDone[id]).length;
  const buildComplete = allTasks.length > 0 && doneCount === allTasks.length;

  return (
    <div className={styles.shell}>
      {showConfetti && <Confetti />}

      <TopBar
        mode={state.mode}
        onModeChange={setMode}
        connected={state.connected}
        connectedPortal={state.connected ? MOCK_HUBSPOT_SCAN.portal : null}
        view={state.view}
        onBackToCanvas={() => setView("canvas")}
        onReset={resetAll}
      />

      {state.view === "canvas" && (
        <main className={styles.canvasShell}>
          <section className={styles.canvasMain}>
            <CanvasHeader
              mode={state.mode}
              componentsSet={componentsSetCount}
              total={SYSTEM_COMPONENTS.length}
              onConnect={runConnect}
              connected={state.connected}
            />

            <SystemCanvas
              state={state}
              brokenChains={brokenChains}
              onTileClick={(id) => setActiveComponentId(id)}
              activeId={activeComponentId}
            />

            {componentsSetCount >= 4 && (
              <div className={styles.exportCta}>
                <div>
                  <div className={styles.exportCtaTitle}>
                    Ready to export the playbook?
                  </div>
                  <div className={styles.exportCtaSub}>
                    Generate the tailored implementation plan from your canvas
                    state — {componentsSetCount} of {SYSTEM_COMPONENTS.length}{" "}
                    components configured.
                  </div>
                </div>
                <button
                  className={`${styles.btn} ${styles.btnLime} ${styles.btnLg}`}
                  onClick={openPlan}
                >
                  Generate Playbook →
                </button>
              </div>
            )}
          </section>

          <aside className={styles.canvasSidebar}>
            <ContextCard
              context={state.context}
              onChange={updateContext}
              mode={state.mode}
              connected={state.connected}
            />
            <ImpactScorecard impact={impact} mode={state.mode} />
            <TopGapsCard
              state={state}
              onTileClick={(id) => setActiveComponentId(id)}
            />
          </aside>
        </main>
      )}

      {state.view === "plan" && plan && (
        <PlanOutput plan={plan} mode={state.mode} onContinue={goBuild} />
      )}

      {state.view === "build" && plan && (
        <BuildOutput
          plan={plan}
          tasksDone={state.tasksDone}
          onToggle={(id) =>
            setState((p) => ({
              ...p,
              tasksDone: { ...p.tasksDone, [id]: !p.tasksDone[id] },
            }))
          }
          onComplete={goComplete}
          canComplete={buildComplete}
        />
      )}

      {state.view === "complete" && plan && (
        <CompleteOutput
          plan={plan}
          onBackToCanvas={() => setView("canvas")}
        />
      )}

      {activeComponent && (
        <DiagnosticPanel
          component={activeComponent}
          maturity={state.components[activeComponent.id] ?? 0}
          note={state.notes[activeComponent.id] ?? ""}
          mode={state.mode}
          dependencies={activeComponent.dependencies?.map((depId) => ({
            id: depId,
            name: COMPONENT_INDEX[depId]?.name ?? depId,
            maturity: state.components[depId] ?? 0,
          }))}
          onClose={() => setActiveComponentId(null)}
          onMaturityChange={(m) => setMaturity(activeComponent.id, m)}
          onNoteChange={(n) => setNote(activeComponent.id, n)}
        />
      )}

      {showConnect && (
        <ConnectModal
          scanning={scanning}
          result={scanning ? null : MOCK_HUBSPOT_SCAN}
          onClose={() => setShowConnect(false)}
        />
      )}
    </div>
  );
}

/* ============================ Top bar ============================ */

function TopBar({
  mode,
  onModeChange,
  connected,
  connectedPortal,
  view,
  onBackToCanvas,
  onReset,
}: {
  mode: Mode;
  onModeChange: (m: Mode) => void;
  connected: boolean;
  connectedPortal: string | null;
  view: SystemState["view"];
  onBackToCanvas: () => void;
  onReset: () => void;
}) {
  return (
    <header className={styles.topbar}>
      <div className={styles.brand}>
        <div className={styles.brandMark}>RE</div>
        <div>
          <div style={{ fontWeight: 700 }}>The Retention Engine</div>
          <div className={styles.brandSub}>
            {connected && connectedPortal ? (
              <span>
                <span className={styles.connectedDot} /> Connected · {connectedPortal}
              </span>
            ) : (
              "Renewal Management System Builder"
            )}
          </div>
        </div>
      </div>

      <div className={styles.topbarActions}>
        {view !== "canvas" && (
          <button
            className={`${styles.btn} ${styles.btnGhostDark} no-print`}
            onClick={onBackToCanvas}
          >
            ← Back to canvas
          </button>
        )}
        {view === "canvas" && (
          <div className={styles.modeSwitch}>
            <button
              className={`${styles.modeChip} ${mode === "architect" ? styles.modeActive : ""}`}
              onClick={() => onModeChange("architect")}
            >
              Architect
            </button>
            <button
              className={`${styles.modeChip} ${mode === "cro" ? styles.modeActive : ""}`}
              onClick={() => onModeChange("cro")}
            >
              CRO
            </button>
            <button
              className={`${styles.modeChip} ${mode === "integration" ? styles.modeActive : ""}`}
              onClick={() => onModeChange("integration")}
            >
              Integration
            </button>
          </div>
        )}
        <button
          className={`${styles.btn} ${styles.btnGhostDark} no-print`}
          onClick={onReset}
        >
          Reset
        </button>
      </div>
    </header>
  );
}

/* ============================ Canvas header ============================ */

function CanvasHeader({
  mode,
  componentsSet,
  total,
  onConnect,
  connected,
}: {
  mode: Mode;
  componentsSet: number;
  total: number;
  onConnect: () => void;
  connected: boolean;
}) {
  const headline =
    mode === "cro"
      ? "Where is churn hiding in your business?"
      : mode === "integration"
        ? "Scan your CRM. See what's missing."
        : "Diagnose the renewal system. Design the missing pieces.";

  const sub =
    mode === "cro"
      ? "Click any tile to see what best-in-class looks like — and how your team compares. Live impact updates in the sidebar."
      : mode === "integration"
        ? "Connect HubSpot to auto-detect maturity. Adjust each component as you validate with the team."
        : "Click any component to diagnose its current state, see benchmarks, and set the target maturity. Dependencies highlight broken chains across layers.";

  return (
    <div className={styles.canvasHeader}>
      <div>
        <div className={styles.canvasEyebrow}>
          Renewal Management Diagnostic Canvas
        </div>
        <h1 className={styles.canvasHeadline}>{headline}</h1>
        <p className={styles.canvasSub}>{sub}</p>
      </div>
      <div className={styles.canvasActions}>
        <div className={styles.canvasProgress}>
          <span>
            <b>{componentsSet}</b> of {total} components configured
          </span>
          <div className={styles.canvasProgressBar}>
            <div
              className={styles.canvasProgressFill}
              style={{ width: `${(componentsSet / total) * 100}%` }}
            />
          </div>
        </div>
        {!connected && (
          <button
            className={`${styles.btn} ${styles.btnPrimary} no-print`}
            onClick={onConnect}
          >
            ⚡ Connect HubSpot
          </button>
        )}
      </div>
    </div>
  );
}

/* ============================ System canvas ============================ */

function SystemCanvas({
  state,
  brokenChains,
  onTileClick,
  activeId,
}: {
  state: SystemState;
  brokenChains: Record<string, string[]>;
  onTileClick: (id: string) => void;
  activeId: string | null;
}) {
  return (
    <div className={styles.canvas}>
      {LAYER_ORDER.map((layer) => {
        const tiles = SYSTEM_COMPONENTS.filter((c) => c.layer === layer);
        return (
          <div key={layer} className={styles.layer}>
            <div className={styles.layerLabel}>{LAYER_LABELS[layer]}</div>
            <div className={styles.layerTiles}>
              {tiles.map((comp) => (
                <ComponentTile
                  key={comp.id}
                  component={comp}
                  maturity={state.components[comp.id] ?? 0}
                  active={activeId === comp.id}
                  broken={!!brokenChains[comp.id]}
                  hasNote={!!state.notes[comp.id]}
                  onClick={() => onTileClick(comp.id)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ComponentTile({
  component,
  maturity,
  active,
  broken,
  hasNote,
  onClick,
}: {
  component: (typeof SYSTEM_COMPONENTS)[number];
  maturity: Maturity;
  active: boolean;
  broken: boolean;
  hasNote: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`${styles.tile} ${styles[`mat-${maturity}`]} ${active ? styles.tileActive : ""} ${broken ? styles.tileBroken : ""}`}
      onClick={onClick}
    >
      <div className={styles.tileHeader}>
        <span className={`${styles.matDot} ${styles[`matDot-${maturity}`]}`} />
        <span className={styles.matLabel}>{MATURITY_LABELS[maturity]}</span>
        {hasNote && <span className={styles.noteMark} title="Has notes">✎</span>}
        {broken && <span className={styles.brokenMark} title="Broken dependency">!</span>}
      </div>
      <div className={styles.tileName}>{component.name}</div>
      <div className={styles.tileDesc}>{component.shortDescription}</div>
    </button>
  );
}

/* ============================ Context card (sidebar) ============================ */

function ContextCard({
  context,
  onChange,
  mode,
  connected,
}: {
  context: SystemState["context"];
  onChange: <K extends keyof SystemState["context"]>(
    k: K,
    v: SystemState["context"][K],
  ) => void;
  mode: Mode;
  connected: boolean;
}) {
  return (
    <div className={styles.sidebarCard}>
      <div className={styles.sidebarTitle}>
        {mode === "cro" ? "Your company" : "Account context"}
        {connected && <span className={styles.autoFilledBadge}>auto-filled</span>}
      </div>
      <div className={styles.contextRow}>
        <label>Accounts</label>
        <select
          value={context.accountCount ?? ""}
          onChange={(e) =>
            onChange(
              "accountCount",
              (e.target.value || null) as typeof context.accountCount,
            )
          }
        >
          <option value="">—</option>
          <option value="under_50">Under 50</option>
          <option value="50_200">50 – 200</option>
          <option value="200_500">200 – 500</option>
          <option value="500_plus">500+</option>
        </select>
      </div>
      <div className={styles.contextRow}>
        <label>ARR</label>
        <select
          value={context.arrBand ?? ""}
          onChange={(e) =>
            onChange("arrBand", (e.target.value || null) as typeof context.arrBand)
          }
        >
          <option value="">—</option>
          <option value="under_1m">&lt; $1M</option>
          <option value="1_5m">$1 – 5M</option>
          <option value="5_10m">$5 – 10M</option>
          <option value="10_25m">$10 – 25M</option>
          <option value="25_50m">$25 – 50M</option>
          <option value="50_plus_m">$50M+</option>
        </select>
      </div>
      <div className={styles.contextRow}>
        <label>CRM</label>
        <select
          value={context.crm ?? ""}
          onChange={(e) =>
            onChange("crm", (e.target.value || null) as typeof context.crm)
          }
        >
          <option value="">—</option>
          <option value="hubspot">HubSpot</option>
          <option value="salesforce">Salesforce</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div className={styles.contextRow}>
        <label>Current GRR</label>
        <div className={styles.grrRow}>
          <input
            type="range"
            min={70}
            max={100}
            step={0.5}
            value={context.currentGrr ?? 90}
            onChange={(e) => onChange("currentGrr", Number(e.target.value))}
          />
          <span className={styles.grrReadout}>
            {context.currentGrr ?? 90}%
          </span>
        </div>
      </div>
    </div>
  );
}

/* ============================ Impact scorecard (sidebar) ============================ */

function ImpactScorecard({
  impact,
  mode,
}: {
  impact: ReturnType<typeof computeChurnImpact>;
  mode: Mode;
}) {
  const headline =
    mode === "cro" ? "Revenue Impact" : "Live Churn Impact";
  return (
    <div className={styles.sidebarCard}>
      <div className={styles.sidebarTitle}>
        <span className={styles.livePulse} /> {headline}
      </div>

      <div className={styles.impactBig}>
        <div className={styles.impactBigNum}>{impact.systemMaturity}</div>
        <div className={styles.impactBigLabel}>
          System maturity score
          <span className={styles.impactBigSub}>(0–100)</span>
        </div>
        <div className={styles.systemBar}>
          <div
            className={styles.systemBarFill}
            style={{ width: `${impact.systemMaturity}%` }}
          />
        </div>
      </div>

      <div className={styles.scoreRow}>
        <span className={styles.scoreLabel}>GRR lift</span>
        <span className={`${styles.scoreValue} ${styles.lift}`}>
          +{impact.grrLiftPoints}pp
        </span>
      </div>
      <div className={styles.scoreRow}>
        <span className={styles.scoreLabel}>NRR lift</span>
        <span className={`${styles.scoreValue} ${styles.lift}`}>
          +{impact.projectedNrrLift}pp
        </span>
      </div>
      <div className={styles.scoreRow}>
        <span className={styles.scoreLabel}>ARR recovered</span>
        <span className={`${styles.scoreValue} ${styles.lift}`}>
          {formatCurrency(impact.arrSavedPerYear)}/yr
        </span>
      </div>
      <div className={styles.scoreRow}>
        <span className={styles.scoreLabel}>ARR expanded</span>
        <span className={`${styles.scoreValue} ${styles.lift}`}>
          {formatCurrency(impact.arrExpansionPerYear)}/yr
        </span>
      </div>
      <div className={styles.scoreRow}>
        <span className={styles.scoreLabel}>Surprise churn</span>
        <span className={styles.scoreValue} style={{ fontSize: "1rem" }}>
          <span className={styles.drop}>{impact.currentSurpriseChurn}%</span>
          <span style={{ color: "var(--muted)", margin: "0 6px" }}>→</span>
          <span className={styles.lift}>{impact.projectedSurpriseChurn}%</span>
        </span>
      </div>
      <div className={styles.scoreFootnote}>
        {impact.timeToRiskDetection}. Recalculates on every maturity change.
      </div>
    </div>
  );
}

/* ============================ Top gaps card ============================ */

function TopGapsCard({
  state,
  onTileClick,
}: {
  state: SystemState;
  onTileClick: (id: string) => void;
}) {
  const gaps = rankGaps(state).slice(0, 5);
  if (gaps.length === 0) return null;
  return (
    <div className={styles.sidebarCard}>
      <div className={styles.sidebarTitle}>Top gaps by churn impact</div>
      {gaps.map((g) => (
        <button
          key={g.component.id}
          className={styles.gapRow}
          onClick={() => onTileClick(g.component.id)}
        >
          <span className={`${styles.matDot} ${styles[`matDot-${g.current}`]}`} />
          <span className={styles.gapRowName}>{g.component.name}</span>
          <span className={styles.gapRowLift}>
            +{g.liftAvailable.toFixed(1)}pp
          </span>
        </button>
      ))}
    </div>
  );
}

/* ============================ Diagnostic panel ============================ */

function DiagnosticPanel({
  component,
  maturity,
  note,
  mode,
  dependencies,
  onClose,
  onMaturityChange,
  onNoteChange,
}: {
  component: (typeof SYSTEM_COMPONENTS)[number];
  maturity: Maturity;
  note: string;
  mode: Mode;
  dependencies?: { id: string; name: string; maturity: Maturity }[];
  onClose: () => void;
  onMaturityChange: (m: Maturity) => void;
  onNoteChange: (n: string) => void;
}) {
  return (
    <>
      <div className={styles.panelBackdrop} onClick={onClose} />
      <aside className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <div className={styles.panelEyebrow}>
              {LAYER_LABELS[component.layer]} · Component
            </div>
            <h2 className={styles.panelTitle}>{component.name}</h2>
          </div>
          <button className={styles.panelClose} onClick={onClose}>
            ✕
          </button>
        </div>

        <div className={styles.panelSection}>
          <p className={styles.panelDesc}>
            {mode === "cro" && component.croFraming
              ? component.croFraming
              : component.description}
          </p>
          <div className={styles.panelWhyBlock}>
            <b>Why it matters:</b> {component.whyItMatters}
          </div>
        </div>

        <div className={styles.panelSection}>
          <div className={styles.panelLabel}>Current maturity</div>
          <div className={styles.maturitySelector}>
            {([0, 1, 2, 3, 4] as Maturity[]).map((m) => (
              <button
                key={m}
                className={`${styles.matButton} ${styles[`matButton-${m}`]} ${maturity === m ? styles.matButtonActive : ""}`}
                onClick={() => onMaturityChange(m)}
              >
                <div className={styles.matButtonNum}>{m}</div>
                <div className={styles.matButtonName}>{MATURITY_LABELS[m]}</div>
              </button>
            ))}
          </div>
          <div className={styles.matDefinition}>
            {component.maturityDefinitions[maturity]}
          </div>
        </div>

        <div className={styles.panelSection}>
          <div className={styles.panelLabel}>Benchmark</div>
          <div className={styles.benchmarkBlock}>{component.benchmark}</div>
        </div>

        <div className={styles.panelSection}>
          <div className={styles.panelLabel}>Diagnostic questions</div>
          <ul className={styles.panelQuestions}>
            {component.diagnosticQuestions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </div>

        <div className={styles.panelSection}>
          <div className={styles.panelLabel}>Recommended first action</div>
          <div className={styles.panelAction}>{component.recommendedAction}</div>
        </div>

        {dependencies && dependencies.length > 0 && (
          <div className={styles.panelSection}>
            <div className={styles.panelLabel}>Depends on</div>
            <div className={styles.depRow}>
              {dependencies.map((d) => (
                <span
                  key={d.id}
                  className={`${styles.depPill} ${styles[`depPill-${d.maturity === 0 ? "missing" : "ok"}`]}`}
                >
                  <span className={`${styles.matDot} ${styles[`matDot-${d.maturity}`]}`} />
                  {d.name}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className={styles.panelSection}>
          <div className={styles.panelLabel}>Playbook excerpt</div>
          <blockquote className={styles.panelQuote}>
            {component.playbookExcerpt}
          </blockquote>
        </div>

        {mode !== "cro" && (
          <div className={styles.panelSection}>
            <div className={styles.panelLabel}>Architect / workshop notes</div>
            <textarea
              className={styles.panelNotes}
              placeholder="Capture observations from the live session — current process, stakeholders, blockers, quotes..."
              value={note}
              onChange={(e) => onNoteChange(e.target.value)}
            />
          </div>
        )}
      </aside>
    </>
  );
}

/* ============================ Connect modal ============================ */

function ConnectModal({
  scanning,
  result,
  onClose,
}: {
  scanning: boolean;
  result: typeof MOCK_HUBSPOT_SCAN | null;
  onClose: () => void;
}) {
  return (
    <>
      <div className={styles.panelBackdrop} onClick={scanning ? undefined : onClose} />
      <div className={styles.connectModal}>
        {scanning ? (
          <div className={styles.scanning}>
            <div className={styles.scanSpinner} />
            <div className={styles.scanTitle}>Scanning HubSpot portal…</div>
            <div className={styles.scanSub}>
              Reading workflows, deal properties, pipeline stages, and
              integrations
            </div>
            <div className={styles.scanSteps}>
              <div>✓ Authenticating</div>
              <div>✓ Reading workflows (47 found)</div>
              <div>✓ Reading deal properties (18 found)</div>
              <div>… Inferring component maturity</div>
            </div>
          </div>
        ) : result ? (
          <div className={styles.scanResult}>
            <div className={styles.scanEyebrow}>Scan complete</div>
            <h2 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "var(--space-2)" }}>
              {result.portal}
            </h2>
            <div className={styles.scanFindings}>
              <div>
                <b>{result.findings.workflows}</b> workflows
              </div>
              <div>
                <b>{result.findings.renewalWorkflows}</b> renewal-related
              </div>
              <div>
                <b>{result.findings.dealProperties}</b> deal properties
              </div>
              <div>
                <b>{result.findings.integrations.length}</b> integrations
              </div>
            </div>

            <div className={styles.panelLabel} style={{ marginTop: "var(--space-5)" }}>
              Detected gaps
            </div>
            <ul className={styles.scanGaps}>
              {result.detectedGaps.map((g, i) => (
                <li key={i}>{g}</li>
              ))}
            </ul>

            <div style={{ marginTop: "var(--space-5)", textAlign: "right" }}>
              <button
                className={`${styles.btn} ${styles.btnPrimary} ${styles.btnLg}`}
                onClick={onClose}
              >
                Apply to canvas →
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}

/* ============================ Plan / Build / Complete outputs ============================ */

function PlanOutput({
  plan,
  mode,
  onContinue,
}: {
  plan: Plan;
  mode: Mode;
  onContinue: () => void;
}) {
  return (
    <main className={styles.outputMain}>
      <section className={styles.planHeader}>
        <div>
          <div style={{ fontSize: "var(--text-xs)", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--ls-lime)", fontWeight: 700, marginBottom: 6 }}>
            {mode === "cro" ? "Your Retention Blueprint" : "Retention Engine Playbook"}
          </div>
          <div style={{ fontSize: "var(--text-2xl)", fontWeight: 800, letterSpacing: "-0.02em" }}>
            {mode === "cro"
              ? "Here's the growth your system can unlock"
              : "Generated plan — churn impact forecast"}
          </div>
        </div>
        <div style={{ display: "flex", gap: "var(--space-2)" }}>
          <button
            className={`${styles.btn} ${styles.btnGhostDark} no-print`}
            onClick={() => window.print()}
          >
            Print / PDF
          </button>
          <button className={`${styles.btn} ${styles.btnLime} ${styles.btnLg} no-print`} onClick={onContinue}>
            Continue to Build →
          </button>
        </div>
      </section>

      <div className={styles.planStats}>
        <div className={`${styles.planStat} ${styles.retained}`}>
          <div className={styles.planStatLabel}>GRR Lift</div>
          <div className={styles.planStatValue} style={{ color: "var(--retained)" }}>
            +{plan.impact.grrLiftPoints}pp
          </div>
          <div className={styles.planStatSub}>
            {plan.impact.currentGrr}% → {plan.impact.projectedGrr}%
          </div>
        </div>
        <div className={`${styles.planStat} ${styles.retained}`}>
          <div className={styles.planStatLabel}>ARR Recovered / Year</div>
          <div className={styles.planStatValue} style={{ color: "var(--retained)" }}>
            {formatCurrency(plan.impact.arrSavedPerYear)}
          </div>
          <div className={styles.planStatSub}>
            Assumes {formatCurrency(plan.impact.estimatedArr)} ARR base
          </div>
        </div>
        <div className={`${styles.planStat} ${styles.retained}`}>
          <div className={styles.planStatLabel}>ARR Expansion / Year</div>
          <div className={styles.planStatValue} style={{ color: "var(--retained)" }}>
            {formatCurrency(plan.impact.arrExpansionPerYear)}
          </div>
          <div className={styles.planStatSub}>NRR lift +{plan.impact.projectedNrrLift}pp</div>
        </div>
        <div className={`${styles.planStat} ${styles.risk}`}>
          <div className={styles.planStatLabel}>Surprise Churn</div>
          <div className={styles.planStatValue}>
            {plan.impact.currentSurpriseChurn}% →{" "}
            <span style={{ color: "var(--retained)" }}>
              {plan.impact.projectedSurpriseChurn}%
            </span>
          </div>
          <div className={styles.planStatSub}>Churn flagged in advance</div>
        </div>
      </div>

      <section className={styles.card}>
        <div className={styles.sectionLabel}>Recommended approach</div>
        <div className={styles.approach}>
          <div className={styles.approachBadge}>
            {plan.approach === "cs_platform"
              ? "CS Platform"
              : plan.approach === "hybrid"
                ? "Hybrid"
                : "CRM-Native"}
          </div>
          <div style={{ lineHeight: 1.6 }}>{plan.approachRationale}</div>
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.cardTitle}>Priority gaps to close</div>
        <div className={styles.cardSub}>
          Ranked by churn impact. Top 3 typically capture 70% of the lift.
        </div>
        {plan.gaps.map((g) => (
          <div key={g.id} className={styles.gap}>
            <div className={styles.gapImpact}>
              <span className={styles.pp}>+{g.churnImpactPoints}</span>
              <span className={styles.ppLabel}>pp GRR</span>
            </div>
            <div>
              <div className={styles.gapTitle}>{g.title}</div>
              <div className={styles.gapRationale}>{g.rationale}</div>
            </div>
            <span className={`${styles.effortPill} ${styles[`effort-${g.effort}`]}`}>
              {g.effort}
            </span>
          </div>
        ))}
      </section>

      <section className={styles.card}>
        <div className={styles.cardTitle}>Health score design</div>
        <div className={styles.cardSub}>
          Weighted composite. Green / yellow / red thresholds drive routing.
        </div>
        <table className={styles.signalTable}>
          <thead>
            <tr>
              <th>Signal</th>
              <th>Weight</th>
              <th>Source</th>
              <th>Availability</th>
            </tr>
          </thead>
          <tbody>
            {plan.healthDesign.signals.map((s) => (
              <tr key={s.name}>
                <td>{s.name}</td>
                <td className={styles.signalWeight}>{s.weight}%</td>
                <td style={{ color: "var(--muted)" }}>{s.source}</td>
                <td>
                  <span className={`${styles.availability} ${styles[`avail-${s.available}`]}`}>
                    {s.available.replace("_", " ")}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className={styles.thresholds}>
          <div className={`${styles.threshold} ${styles["thr-green"]}`}>
            <span className={styles.tn}>{plan.healthDesign.threshold.green}+</span>
            Green
          </div>
          <div className={`${styles.threshold} ${styles["thr-yellow"]}`}>
            <span className={styles.tn}>
              {plan.healthDesign.threshold.red}–{plan.healthDesign.threshold.yellow}
            </span>
            Yellow
          </div>
          <div className={`${styles.threshold} ${styles["thr-red"]}`}>
            <span className={styles.tn}>&lt;{plan.healthDesign.threshold.red}</span>
            Red
          </div>
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.cardTitle}>90 / 60 / 30-day cadence</div>
        <div className={styles.cardSub}>{plan.staging.ownerModel}</div>
        <div className={styles.cadence}>
          {plan.staging.cadence.map((c) => (
            <Fragment key={c.day}>
              <div className={`${styles.dayPill} ${c.day === 0 ? styles.d0 : ""}`}>
                {c.day === 0 ? "Day 0" : `-${c.day} days`}
              </div>
              <div>
                <div className={styles.cadenceAction}>{c.action}</div>
                <div className={styles.cadenceAlert}>{c.alert}</div>
              </div>
            </Fragment>
          ))}
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.cardTitle}>Playbooks</div>
        <div className={styles.cardSub}>
          Documented motions with triggers, steps, and owner.
        </div>
        <div className={styles.playbooks}>
          {plan.playbooks.map((pb) => (
            <div key={pb.id} className={styles.playbook}>
              <div className={styles.playbookTitle}>{pb.title}</div>
              <div className={styles.playbookGoal}>{pb.goal}</div>
              <div className={styles.playbookLabel}>Triggers</div>
              <ul className={styles.playbookList}>
                {pb.triggers.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
              <div className={styles.playbookLabel}>Steps</div>
              <ol className={styles.playbookList}>
                {pb.steps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
              <div className={styles.playbookOwner}>
                Owner: <b>{pb.owner}</b>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.cardTitle}>CSM routing rules</div>
        <ul className={styles.routingList}>
          {plan.routingRules.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      </section>

      <section className={styles.card}>
        <div className={styles.cardTitle}>Process automations</div>
        <div className={styles.cardSub}>
          Specific workflows — tailored to your CRM of record.
        </div>
        {plan.automations.map((a) => (
          <div key={a.name} className={styles.automation}>
            <div className={styles.automationHeader}>
              <span className={styles.automationName}>{a.name}</span>
              <span className={styles.systemBadge}>{a.system}</span>
            </div>
            <div className={styles.automationField}>
              <b>Trigger</b> {a.trigger}
            </div>
            <div className={styles.automationField}>
              <b>Action</b> {a.action}
            </div>
            <div className={styles.automationField}>
              <b>Recipient</b> {a.recipient}
            </div>
          </div>
        ))}
      </section>

      <section className={styles.card}>
        <div className={styles.cardTitle}>Success metrics</div>
        <div className={styles.cardSub}>
          Instrument on day one. Leading indicators measure usage; lagging
          indicators measure outcome.
        </div>
        <div className={styles.metricGrid}>
          {plan.successMetrics.map((m, i) => (
            <div key={i} className={styles.metric}>
              <div className={styles.metricName}>{m.metric}</div>
              <div className={styles.metricDelta}>
                <span className={styles.metricBase}>{m.baseline}</span>
                <span className={styles.metricArrow}>→</span>
                <span className={styles.metricTarget}>{m.target}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className={styles.btnRow}>
        <span style={{ color: "var(--muted)", fontSize: "var(--text-sm)" }}>
          Plan generated from canvas state. Continue to build it step by step.
        </span>
        <button
          className={`${styles.btn} ${styles.btnPrimary} ${styles.btnLg} no-print`}
          onClick={onContinue}
        >
          Continue to Build →
        </button>
      </div>
    </main>
  );
}

function BuildOutput({
  plan,
  tasksDone,
  onToggle,
  onComplete,
  canComplete,
}: {
  plan: Plan;
  tasksDone: Record<string, boolean>;
  onToggle: (id: string) => void;
  onComplete: () => void;
  canComplete: boolean;
}) {
  const total = plan.phases.reduce((acc, p) => acc + p.tasks.length, 0);
  const done = plan.phases
    .flatMap((p) => p.tasks)
    .filter((t) => tasksDone[t.id]).length;

  return (
    <main className={styles.outputMain}>
      <section className={styles.card}>
        <div className={styles.cardTitle}>Implementation roadmap</div>
        <div className={styles.cardSub}>
          Four phases, typically 60–100 hours end-to-end.
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "var(--space-3)" }}>
          <div style={{ fontWeight: 700, color: "var(--ls-purple)" }}>
            {done} / {total} tasks complete
          </div>
          <div style={{ fontSize: "var(--text-sm)", color: "var(--muted)" }}>
            {Math.round((done / total) * 100)}% done
          </div>
        </div>
        <div className={styles.phaseProgress} style={{ marginTop: "var(--space-3)" }}>
          <div className={styles.phaseProgressFill} style={{ width: `${(done / total) * 100}%` }} />
        </div>
      </section>

      {plan.phases.map((phase) => {
        const phaseDone = phase.tasks.filter((t) => tasksDone[t.id]).length;
        const phasePct = (phaseDone / phase.tasks.length) * 100;
        return (
          <section key={phase.id} className={styles.phase}>
            <div className={styles.phaseHeader}>
              <div className={styles.phaseMeta}>
                <span className={styles.phaseName}>{phase.name}</span>
                <span className={styles.phaseHours}>
                  {phase.hours[0]}–{phase.hours[1]} hrs
                </span>
              </div>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--muted)", fontWeight: 600 }}>
                {phaseDone}/{phase.tasks.length} done
              </div>
            </div>
            <div className={styles.phaseMilestone}>
              <b>Expected milestone:</b> {phase.expectedMilestone}
            </div>
            {phase.tasks.map((task) => (
              <div
                key={task.id}
                className={`${styles.task} ${tasksDone[task.id] ? styles.done : ""}`}
                onClick={() => onToggle(task.id)}
              >
                <div className={`${styles.checkbox} ${tasksDone[task.id] ? styles.checked : ""}`}>
                  {tasksDone[task.id] && "✓"}
                </div>
                <div style={{ flex: 1 }}>
                  <div className={styles.taskLabel}>{task.label}</div>
                  <div className={styles.taskMeta}>
                    <span>
                      <b style={{ color: "var(--ink)" }}>{task.owner}</b>
                    </span>
                    <span>· {task.hours} hrs</span>
                  </div>
                </div>
              </div>
            ))}
            <div className={styles.phaseProgress}>
              <div className={styles.phaseProgressFill} style={{ width: `${phasePct}%` }} />
            </div>
          </section>
        );
      })}

      <div className={styles.btnRow}>
        <span style={{ color: "var(--muted)", fontSize: "var(--text-sm)" }}>
          {canComplete ? "All tasks complete." : `${total - done} remaining.`}
        </span>
        <button
          className={`${styles.btn} ${styles.btnLime} ${styles.btnLg}`}
          onClick={onComplete}
          disabled={!canComplete}
        >
          Complete engagement →
        </button>
      </div>
    </main>
  );
}

function CompleteOutput({
  plan,
  onBackToCanvas,
}: {
  plan: Plan;
  onBackToCanvas: () => void;
}) {
  return (
    <main className={styles.outputMain}>
      <section className={styles.completeWrap}>
        <div className={styles.completeEyebrow}>Engagement Complete</div>
        <h1 className={styles.completeTitle}>The retention engine is live.</h1>
        <p className={styles.completeSub}>
          Projected GRR lift of <b>+{plan.impact.grrLiftPoints}pp</b> and NRR lift of{" "}
          <b>+{plan.impact.projectedNrrLift}pp</b> — approximately{" "}
          <b>{formatCurrency(plan.impact.arrSavedPerYear + plan.impact.arrExpansionPerYear)}</b>{" "}
          in recurring revenue unlocked per year. Surprise churn cut from{" "}
          <b>{plan.impact.currentSurpriseChurn}%</b> to{" "}
          <b>{plan.impact.projectedSurpriseChurn}%</b>.
        </p>
        <div className={styles.completeActions}>
          <button
            className={`${styles.btn} ${styles.btnLime} ${styles.btnLg}`}
            onClick={() => window.print()}
          >
            Print / Save as PDF
          </button>
          <button
            className={`${styles.btn} ${styles.btnGhostDark} ${styles.btnLg}`}
            onClick={onBackToCanvas}
          >
            Back to canvas
          </button>
        </div>
      </section>
    </main>
  );
}

/* ============================ Confetti ============================ */

function Confetti() {
  const colors = ["#e8ffcf", "#d9afd0", "#642585", "#fbbf24", "#059669", "#fff"];
  const pieces = Array.from({ length: 80 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.8,
    duration: 2 + Math.random() * 2.5,
    color: colors[i % colors.length],
  }));
  return (
    <div className={styles.confetti}>
      {pieces.map((p) => (
        <span
          key={p.id}
          className={styles.confettiPiece}
          style={{
            left: `${p.left}%`,
            background: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>
  );
}
