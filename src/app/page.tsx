"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import {
  computeChurnImpact,
  formatCurrency,
  rankGaps,
} from "@/lib/churnImpact";
import {
  COMPONENT_INDEX,
  SYSTEM_COMPONENTS,
} from "@/lib/components-catalog";
import { generatePlan } from "@/lib/planGenerator";
import {
  formatDiscoveryNotes,
  formatTasksAsMarkdown,
  generateTeamworkTasks,
} from "@/lib/teamwork";
import {
  emptySystemState,
  LAYER_LABELS,
  MATURITY_LABELS,
  type DiscoveryView,
  type Maturity,
  type Plan,
  type SystemComponent,
  type SystemState,
} from "@/lib/types";
import styles from "./page.module.css";

const STORAGE_KEY = "retention-engine:v3";

export default function Home() {
  const [state, setState] = useState<SystemState>(emptySystemState);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loadedFromStorage, setLoadedFromStorage] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

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

  useEffect(() => {
    if (!loadedFromStorage) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, loadedFromStorage]);

  const visibleComponents = useMemo(
    () => SYSTEM_COMPONENTS.filter((c) => !state.hidden.includes(c.id)),
    [state.hidden],
  );

  const impact = useMemo(() => computeChurnImpact(state), [state]);
  const plan: Plan | null = useMemo(
    () => (state.view === "summary" || state.view === "playbook" ? generatePlan(state) : null),
    [state],
  );

  const configuredCount = Object.entries(state.components).filter(
    ([id, m]) => m > 0 && !state.hidden.includes(id),
  ).length;

  const setView = (view: DiscoveryView) => setState((p) => ({ ...p, view }));
  const setCurrentIndex = (i: number) =>
    setState((p) => ({ ...p, currentIndex: i }));

  const setMaturity = (id: string, maturity: Maturity) =>
    setState((p) => ({
      ...p,
      components: { ...p.components, [id]: maturity },
    }));

  const setNote = (id: string, note: string) =>
    setState((p) => ({ ...p, notes: { ...p.notes, [id]: note } }));

  const toggleHidden = (id: string) =>
    setState((p) => {
      const hidden = p.hidden.includes(id)
        ? p.hidden.filter((x) => x !== id)
        : [...p.hidden, id];
      const stillVisible = SYSTEM_COMPONENTS.filter((c) => !hidden.includes(c.id));
      const newIndex = Math.min(p.currentIndex, Math.max(0, stillVisible.length - 1));
      return { ...p, hidden, currentIndex: newIndex };
    });

  const updateContext = <K extends keyof SystemState["context"]>(
    key: K,
    value: SystemState["context"][K],
  ) => setState((p) => ({ ...p, context: { ...p.context, [key]: value } }));

  const goNext = () => {
    if (state.currentIndex < visibleComponents.length - 1) {
      setCurrentIndex(state.currentIndex + 1);
    } else {
      goSummary();
    }
  };

  const goPrev = () => {
    if (state.currentIndex > 0) {
      setCurrentIndex(state.currentIndex - 1);
    } else {
      setView("intro");
    }
  };

  const goSummary = () => {
    setView("summary");
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 3000);
  };

  const beginDiscovery = () => {
    setView("component");
    setCurrentIndex(0);
  };

  const skipCurrent = () => {
    const comp = visibleComponents[state.currentIndex];
    if (!comp) return;
    toggleHidden(comp.id);
  };

  const resetAll = () => {
    if (!confirm("Reset the discovery? All notes and maturity levels will be cleared.")) return;
    localStorage.removeItem(STORAGE_KEY);
    setState(emptySystemState);
  };

  const currentComponent = visibleComponents[state.currentIndex] ?? null;

  const isComponentView = state.view === "component" && !!currentComponent;

  return (
    <div className={`${styles.shell} ${isComponentView ? styles.shellFixed : ""}`}>
      {showConfetti && <Confetti />}

      <TopBar
        view={state.view}
        clientName={state.context.clientName}
        onOpenMenu={() => setMenuOpen(true)}
        onReset={resetAll}
        onGoIntro={() => setView("intro")}
      />

      {state.view === "intro" && (
        <IntroScreen
          context={state.context}
          onContextChange={updateContext}
          visibleCount={visibleComponents.length}
          totalCount={SYSTEM_COMPONENTS.length}
          hiddenCount={state.hidden.length}
          onBegin={beginDiscovery}
          hasProgress={configuredCount > 0}
        />
      )}

      {isComponentView && (
        <>
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{
                width: `${((state.currentIndex + 1) / visibleComponents.length) * 100}%`,
              }}
            />
          </div>
          <ComponentScreen
            component={currentComponent}
            maturity={state.components[currentComponent.id] ?? 0}
            note={state.notes[currentComponent.id] ?? ""}
            index={state.currentIndex}
            total={visibleComponents.length}
            dependencies={currentComponent.dependencies?.map((id) => ({
              id,
              name: COMPONENT_INDEX[id]?.name ?? id,
              maturity: state.components[id] ?? 0,
              hidden: state.hidden.includes(id),
            }))}
            onMaturityChange={(m) => setMaturity(currentComponent.id, m)}
            onNoteChange={(n) => setNote(currentComponent.id, n)}
            onSkip={skipCurrent}
            onPrev={goPrev}
            onNext={goNext}
          />
          <ImpactFooter
            impact={impact}
            configured={configuredCount}
            total={visibleComponents.length}
          />
        </>
      )}

      {state.view === "summary" && plan && (
        <SummaryScreen
          plan={plan}
          state={state}
          visibleCount={visibleComponents.length}
          hiddenCount={state.hidden.length}
          onViewPlaybook={() => setView("playbook")}
          onBackToComponent={(index) => {
            setCurrentIndex(index);
            setView("component");
          }}
        />
      )}

      {state.view === "playbook" && plan && (
        <PlaybookScreen plan={plan} onBack={() => setView("summary")} />
      )}

      {menuOpen && (
        <ComponentMenu
          state={state}
          onClose={() => setMenuOpen(false)}
          onJump={(idx) => {
            setCurrentIndex(idx);
            setView("component");
            setMenuOpen(false);
          }}
          onToggleHidden={toggleHidden}
          onGoSummary={() => {
            setView("summary");
            setMenuOpen(false);
          }}
          onGoIntro={() => {
            setView("intro");
            setMenuOpen(false);
          }}
        />
      )}
    </div>
  );
}

/* ============================ Top bar ============================ */

function TopBar({
  view,
  clientName,
  onOpenMenu,
  onReset,
  onGoIntro,
}: {
  view: DiscoveryView;
  clientName: string;
  onOpenMenu: () => void;
  onReset: () => void;
  onGoIntro: () => void;
}) {
  return (
    <header className={styles.topbar}>
      <div className={styles.brand} onClick={onGoIntro} style={{ cursor: "pointer" }}>
        <div className={styles.brandMark}>RE</div>
        <div>
          <div style={{ fontWeight: 700 }}>The Retention Engine</div>
          <div className={styles.brandSub}>
            {clientName ? (
              <>Discovery · <b>{clientName}</b></>
            ) : (
              "Renewal Management Discovery"
            )}
          </div>
        </div>
      </div>
      <div className={styles.topbarActions}>
        {view !== "intro" && (
          <button className={`${styles.btn} ${styles.btnGhost} no-print`} onClick={onOpenMenu}>
            ☰ Components
          </button>
        )}
        <button className={`${styles.btn} ${styles.btnGhost} no-print`} onClick={onReset}>
          Reset
        </button>
      </div>
    </header>
  );
}

/* ============================ Intro screen ============================ */

function IntroScreen({
  context,
  onContextChange,
  visibleCount,
  totalCount,
  hiddenCount,
  onBegin,
  hasProgress,
}: {
  context: SystemState["context"];
  onContextChange: <K extends keyof SystemState["context"]>(
    k: K,
    v: SystemState["context"][K],
  ) => void;
  visibleCount: number;
  totalCount: number;
  hiddenCount: number;
  onBegin: () => void;
  hasProgress: boolean;
}) {
  return (
    <main className={styles.centered}>
      <section className={styles.introCard}>
        <div className={styles.introEyebrow}>Renewal Management Discovery</div>
        <h1 className={styles.introTitle}>
          Walk through the renewal system <em>together</em> on the call.
        </h1>
        <p className={styles.introSub}>
          {totalCount} components across five layers — reporting, automation,
          process, data, and team. One screen per component with discussion
          prompts, notes, maturity assessment, and benchmarks. When you're done,
          export the generated playbook and Teamwork tasks.
        </p>

        <div className={styles.introContextRow}>
          <label className={styles.introLabel}>
            <span>Client / Account</span>
            <input
              type="text"
              placeholder="Acme Software"
              value={context.clientName}
              onChange={(e) => onContextChange("clientName", e.target.value)}
              className={styles.introInput}
            />
          </label>
          <label className={styles.introLabel}>
            <span>ARR band (optional)</span>
            <select
              value={context.arrBand ?? ""}
              onChange={(e) =>
                onContextChange(
                  "arrBand",
                  (e.target.value || null) as typeof context.arrBand,
                )
              }
              className={styles.introInput}
            >
              <option value="">Unknown</option>
              <option value="under_1m">&lt; $1M</option>
              <option value="1_5m">$1 – $5M</option>
              <option value="5_10m">$5 – $10M</option>
              <option value="10_25m">$10 – $25M</option>
              <option value="25_50m">$25 – $50M</option>
              <option value="50_plus_m">$50M+</option>
            </select>
          </label>
        </div>

        <div className={styles.introFooter}>
          <div className={styles.introFooterNote}>
            {hiddenCount > 0 ? (
              <span>
                {visibleCount} active · {hiddenCount} marked not relevant
              </span>
            ) : (
              <span>{totalCount} components to walk through</span>
            )}
          </div>
          <button
            className={`${styles.btn} ${styles.btnLime} ${styles.btnLg}`}
            onClick={onBegin}
          >
            {hasProgress ? "Resume discovery →" : "Begin discovery →"}
          </button>
        </div>
      </section>
    </main>
  );
}

/* ============================ Component screen ============================ */

function ComponentScreen({
  component,
  maturity,
  note,
  index,
  total,
  dependencies,
  onMaturityChange,
  onNoteChange,
  onSkip,
  onPrev,
  onNext,
}: {
  component: SystemComponent;
  maturity: Maturity;
  note: string;
  index: number;
  total: number;
  dependencies?: { id: string; name: string; maturity: Maturity; hidden: boolean }[];
  onMaturityChange: (m: Maturity) => void;
  onNoteChange: (n: string) => void;
  onSkip: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <main className={styles.componentMain}>
      <section className={styles.componentCard}>
        <div className={styles.componentHeader}>
          <div>
            <div className={styles.layerBadge}>{LAYER_LABELS[component.layer]}</div>
            <h1 className={styles.componentName}>{component.name}</h1>
            <p className={styles.componentShort}>{component.shortDescription}</p>
          </div>
          <div className={styles.componentCount}>
            <span className={styles.componentCountNum}>
              {index + 1}
              <span className={styles.componentCountTotal}>/ {total}</span>
            </span>
            <span className={styles.componentCountLabel}>Component</span>
          </div>
        </div>

        <div className={styles.componentGrid}>
          <div className={styles.componentLeft}>
            <Section label="Current maturity">
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
                <b>Level {maturity} — {MATURITY_LABELS[maturity]}:</b>{" "}
                {component.maturityDefinitions[maturity]}
              </div>
            </Section>

            <Section label="Why this matters">
              <p className={styles.sectionBody}>{component.whyItMatters}</p>
            </Section>

            <Section label="Benchmark">
              <div className={styles.benchmark}>{component.benchmark}</div>
            </Section>

            {dependencies && dependencies.length > 0 && (
              <Section label="Depends on">
                <div className={styles.depRow}>
                  {dependencies.map((d) => (
                    <span
                      key={d.id}
                      className={`${styles.depPill} ${d.maturity === 0 ? styles.depMissing : styles.depOk}`}
                    >
                      <span className={`${styles.matDot} ${styles[`matDot-${d.maturity}`]}`} />
                      {d.name}
                      {d.hidden && <span className={styles.depHidden}>skipped</span>}
                    </span>
                  ))}
                </div>
              </Section>
            )}
          </div>

          <div className={styles.componentRight}>
            <Section label="Discussion prompts">
              <ul className={styles.prompts}>
                {component.diagnosticQuestions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </Section>

            <Section label="Notes from the call">
              <textarea
                className={styles.notes}
                placeholder="Capture what you heard — current process, stakeholders, blockers..."
                value={note}
                onChange={(e) => onNoteChange(e.target.value)}
              />
            </Section>
          </div>
        </div>

        <div className={styles.componentNav}>
          <button className={`${styles.btn} ${styles.btnGhost}`} onClick={onPrev}>
            ← Previous
          </button>
          <button className={`${styles.btn} ${styles.btnMuted}`} onClick={onSkip}>
            Not relevant — skip
          </button>
          <button className={`${styles.btn} ${styles.btnLime}`} onClick={onNext}>
            {index === total - 1 ? "Finish discovery →" : "Next →"}
          </button>
        </div>
      </section>
    </main>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionLabel}>{label}</div>
      {children}
    </div>
  );
}

/* ============================ Impact footer ============================ */

function ImpactFooter({
  impact,
  configured,
  total,
}: {
  impact: ReturnType<typeof computeChurnImpact>;
  configured: number;
  total: number;
}) {
  return (
    <section className={styles.impactFooter}>
      <div className={styles.impactFooterLabel}>
        <span className={styles.livePulse} />
        Live impact
      </div>
      <div className={styles.impactMetrics}>
        <div className={styles.impactMetric}>
          <div className={styles.impactMetricNum}>{impact.systemMaturity}</div>
          <div className={styles.impactMetricLabel}>System maturity</div>
        </div>
        <div className={styles.impactMetric}>
          <div className={`${styles.impactMetricNum} ${styles.lift}`}>
            +{impact.grrLiftPoints}pp
          </div>
          <div className={styles.impactMetricLabel}>GRR lift</div>
        </div>
        <div className={styles.impactMetric}>
          <div className={`${styles.impactMetricNum} ${styles.lift}`}>
            +{impact.projectedNrrLift}pp
          </div>
          <div className={styles.impactMetricLabel}>NRR lift</div>
        </div>
        <div className={styles.impactMetric}>
          <div className={styles.impactMetricNum}>
            {configured}/{total}
          </div>
          <div className={styles.impactMetricLabel}>Configured</div>
        </div>
      </div>
    </section>
  );
}

/* ============================ Component menu (drawer) ============================ */

function ComponentMenu({
  state,
  onClose,
  onJump,
  onToggleHidden,
  onGoSummary,
  onGoIntro,
}: {
  state: SystemState;
  onClose: () => void;
  onJump: (idx: number) => void;
  onToggleHidden: (id: string) => void;
  onGoSummary: () => void;
  onGoIntro: () => void;
}) {
  const visible = SYSTEM_COMPONENTS.filter((c) => !state.hidden.includes(c.id));
  return (
    <>
      <div className={styles.menuBackdrop} onClick={onClose} />
      <aside className={styles.menu}>
        <div className={styles.menuHeader}>
          <div className={styles.menuTitle}>Components</div>
          <button className={styles.menuClose} onClick={onClose}>
            ✕
          </button>
        </div>

        <div className={styles.menuMeta}>
          <span>
            {visible.length} active · {state.hidden.length} skipped
          </span>
        </div>

        <div className={styles.menuActions}>
          <button className={`${styles.btn} ${styles.btnGhost}`} onClick={onGoIntro}>
            ← Start over
          </button>
          <button className={`${styles.btn} ${styles.btnLime}`} onClick={onGoSummary}>
            View summary →
          </button>
        </div>

        <div className={styles.menuList}>
          {visible.map((comp, idx) => {
            const m = state.components[comp.id] ?? 0;
            const hasNote = !!state.notes[comp.id]?.trim();
            return (
              <button
                key={comp.id}
                className={styles.menuItem}
                onClick={() => onJump(idx)}
              >
                <span className={`${styles.matDot} ${styles[`matDot-${m}`]}`} />
                <div className={styles.menuItemBody}>
                  <div className={styles.menuItemName}>{comp.name}</div>
                  <div className={styles.menuItemLayer}>
                    {LAYER_LABELS[comp.layer]} · Level {m}
                    {hasNote && <span className={styles.menuItemNote}> · has notes</span>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {state.hidden.length > 0 && (
          <>
            <div className={styles.menuSectionLabel}>Not relevant</div>
            <div className={styles.menuList}>
              {state.hidden
                .map((id) => COMPONENT_INDEX[id])
                .filter(Boolean)
                .map((comp) => (
                  <button
                    key={comp.id}
                    className={`${styles.menuItem} ${styles.menuItemHidden}`}
                    onClick={() => onToggleHidden(comp.id)}
                  >
                    <div className={styles.menuItemBody}>
                      <div className={styles.menuItemName}>{comp.name}</div>
                      <div className={styles.menuItemLayer}>
                        {LAYER_LABELS[comp.layer]} · click to restore
                      </div>
                    </div>
                  </button>
                ))}
            </div>
          </>
        )}
      </aside>
    </>
  );
}

/* ============================ Summary screen ============================ */

function SummaryScreen({
  plan,
  state,
  visibleCount,
  hiddenCount,
  onViewPlaybook,
  onBackToComponent,
}: {
  plan: Plan;
  state: SystemState;
  visibleCount: number;
  hiddenCount: number;
  onViewPlaybook: () => void;
  onBackToComponent: (index: number) => void;
}) {
  const gaps = rankGaps(state).slice(0, 5);
  const configured = Object.entries(state.components).filter(
    ([id, m]) => m > 0 && !state.hidden.includes(id),
  ).length;
  const notedCount = Object.entries(state.notes).filter(
    ([id, n]) => n?.trim() && !state.hidden.includes(id),
  ).length;

  const [showTasks, setShowTasks] = useState(false);
  const [showNotes, setShowNotes] = useState(false);

  const tasks = generateTeamworkTasks(plan, state);
  const tasksMd = formatTasksAsMarkdown(tasks);
  const notesMd = formatDiscoveryNotes(state);

  return (
    <main className={styles.summaryMain}>
      <section className={styles.summaryHeader}>
        <div>
          <div className={styles.summaryEyebrow}>Discovery complete</div>
          <h1 className={styles.summaryTitle}>
            {state.context.clientName || "Your client"}'s retention blueprint.
          </h1>
          <p className={styles.summarySub}>
            {configured} components configured, {notedCount} with captured notes,{" "}
            {hiddenCount} skipped. Generate the playbook and Teamwork tasks
            below.
          </p>
        </div>
      </section>

      <div className={styles.summaryStats}>
        <StatCard
          label="System Maturity"
          value={`${plan.impact.systemMaturity}`}
          sub="out of 100"
        />
        <StatCard
          label="GRR Lift"
          value={`+${plan.impact.grrLiftPoints}pp`}
          sub={`${plan.impact.currentGrr}% → ${plan.impact.projectedGrr}%`}
          accent="retained"
        />
        <StatCard
          label="NRR Lift"
          value={`+${plan.impact.projectedNrrLift}pp`}
          sub="from expansion motion"
          accent="retained"
        />
        <StatCard
          label="ARR Unlocked / Year"
          value={formatCurrency(
            plan.impact.arrSavedPerYear + plan.impact.arrExpansionPerYear,
          )}
          sub={`Saved + expanded, base ${formatCurrency(plan.impact.estimatedArr)}`}
          accent="retained"
        />
      </div>

      <section className={styles.summaryCard}>
        <div className={styles.cardTitle}>Top priority gaps</div>
        <div className={styles.cardSub}>
          Ranked by churn impact. Click any to revisit the discovery screen.
        </div>
        {gaps.length === 0 && (
          <p style={{ color: "var(--muted)" }}>No gaps found — system at full maturity.</p>
        )}
        {gaps.map((g) => {
          const visible = SYSTEM_COMPONENTS.filter((c) => !state.hidden.includes(c.id));
          const compIndex = visible.findIndex((c) => c.id === g.component.id);
          return (
            <button
              key={g.component.id}
              className={styles.gapRow}
              onClick={() => compIndex >= 0 && onBackToComponent(compIndex)}
              disabled={compIndex < 0}
            >
              <div className={styles.gapImpactSmall}>
                +{g.liftAvailable.toFixed(1)}
                <span>pp</span>
              </div>
              <div>
                <div className={styles.gapRowName}>{g.component.name}</div>
                <div className={styles.gapRowLayer}>
                  {LAYER_LABELS[g.component.layer]} · Current level {g.current}
                </div>
              </div>
            </button>
          );
        })}
      </section>

      <section className={styles.summaryCard}>
        <div className={styles.exportRow}>
          <div>
            <div className={styles.cardTitle}>Deliverables</div>
            <div className={styles.cardSub}>
              Three outputs from one discovery call.
            </div>
          </div>
        </div>

        <div className={styles.deliverables}>
          <DeliverableCard
            title="Implementation Playbook"
            description="Approach, gaps, health score design, cadence, playbooks, routing, automations, 4-phase roadmap, success metrics."
            action="View playbook →"
            onClick={onViewPlaybook}
          />
          <DeliverableCard
            title="Teamwork Tasks"
            description={`${tasks.length} tasks across phased lists, ready to import.`}
            action={showTasks ? "Hide preview" : "Preview tasks →"}
            onClick={() => setShowTasks((s) => !s)}
          />
          <DeliverableCard
            title="Discovery Notes"
            description={`${notedCount} components with notes captured on the call.`}
            action={showNotes ? "Hide notes" : "View notes →"}
            onClick={() => setShowNotes((s) => !s)}
          />
        </div>

        {showTasks && (
          <ExportPanel
            content={tasksMd}
            filename={`${(state.context.clientName || "client").toLowerCase().replace(/\s+/g, "-")}-teamwork-tasks.md`}
          />
        )}
        {showNotes && (
          <ExportPanel
            content={notesMd}
            filename={`${(state.context.clientName || "client").toLowerCase().replace(/\s+/g, "-")}-discovery-notes.md`}
          />
        )}
      </section>

      <div className={styles.btnRow}>
        <span style={{ color: "var(--muted)", fontSize: "var(--text-sm)" }}>
          {visibleCount} components covered · recalculates as you adjust
        </span>
        <button
          className={`${styles.btn} ${styles.btnLime} ${styles.btnLg}`}
          onClick={onViewPlaybook}
        >
          View full playbook →
        </button>
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "retained" | "risk";
}) {
  return (
    <div className={`${styles.statCard} ${accent ? styles[`statCard-${accent}`] : ""}`}>
      <div className={styles.statLabel}>{label}</div>
      <div className={styles.statValue}>{value}</div>
      {sub && <div className={styles.statSub}>{sub}</div>}
    </div>
  );
}

function DeliverableCard({
  title,
  description,
  action,
  onClick,
}: {
  title: string;
  description: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <div className={styles.deliverable}>
      <div className={styles.deliverableTitle}>{title}</div>
      <div className={styles.deliverableDesc}>{description}</div>
      <button className={`${styles.btn} ${styles.btnGhost}`} onClick={onClick}>
        {action}
      </button>
    </div>
  );
}

function ExportPanel({ content, filename }: { content: string; filename: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };
  const download = () => {
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className={styles.exportPanel}>
      <div className={styles.exportActions}>
        <button className={`${styles.btn} ${styles.btnGhost}`} onClick={copy}>
          {copied ? "✓ Copied" : "Copy markdown"}
        </button>
        <button className={`${styles.btn} ${styles.btnGhost}`} onClick={download}>
          Download .md
        </button>
      </div>
      <pre className={styles.exportPre}>{content}</pre>
    </div>
  );
}

/* ============================ Playbook screen ============================ */

function PlaybookScreen({
  plan,
  onBack,
}: {
  plan: Plan;
  onBack: () => void;
}) {
  return (
    <main className={styles.playbookMain}>
      <section className={styles.planHeader}>
        <div>
          <div style={{ fontSize: "var(--text-xs)", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--ls-lime)", fontWeight: 700, marginBottom: 6 }}>
            Implementation Playbook
          </div>
          <div style={{ fontSize: "var(--text-2xl)", fontWeight: 800, letterSpacing: "-0.02em" }}>
            Generated from discovery
          </div>
        </div>
        <div style={{ display: "flex", gap: "var(--space-2)" }}>
          <button className={`${styles.btn} ${styles.btnGhost} no-print`} onClick={() => window.print()}>
            Print / PDF
          </button>
          <button className={`${styles.btn} ${styles.btnGhost} no-print`} onClick={onBack}>
            ← Summary
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
          <div className={styles.planStatLabel}>ARR Recovered</div>
          <div className={styles.planStatValue} style={{ color: "var(--retained)" }}>
            {formatCurrency(plan.impact.arrSavedPerYear)}
          </div>
          <div className={styles.planStatSub}>per year</div>
        </div>
        <div className={`${styles.planStat} ${styles.retained}`}>
          <div className={styles.planStatLabel}>ARR Expansion</div>
          <div className={styles.planStatValue} style={{ color: "var(--retained)" }}>
            {formatCurrency(plan.impact.arrExpansionPerYear)}
          </div>
          <div className={styles.planStatSub}>
            NRR +{plan.impact.projectedNrrLift}pp
          </div>
        </div>
        <div className={`${styles.planStat} ${styles.risk}`}>
          <div className={styles.planStatLabel}>Surprise Churn</div>
          <div className={styles.planStatValue}>
            {plan.impact.currentSurpriseChurn}% →{" "}
            <span style={{ color: "var(--retained)" }}>{plan.impact.projectedSurpriseChurn}%</span>
          </div>
          <div className={styles.planStatSub}>flagged in advance</div>
        </div>
      </div>

      <section className={styles.summaryCard}>
        <div className={styles.sectionLabel}>Recommended approach</div>
        <div className={styles.approach}>
          <div className={styles.approachBadge}>
            {plan.approach === "cs_platform" ? "CS Platform" : plan.approach === "hybrid" ? "Hybrid" : "CRM-Native"}
          </div>
          <div style={{ lineHeight: 1.6 }}>{plan.approachRationale}</div>
        </div>
      </section>

      <section className={styles.summaryCard}>
        <div className={styles.cardTitle}>Priority gaps</div>
        <div className={styles.cardSub}>Ranked by churn impact.</div>
        {plan.gaps.map((g) => (
          <div key={g.id} className={styles.gap}>
            <div className={styles.gapImpact}>
              <span className={styles.pp}>+{g.churnImpactPoints}</span>
              <span className={styles.ppLabel}>pp</span>
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

      <section className={styles.summaryCard}>
        <div className={styles.cardTitle}>Health score design</div>
        <div className={styles.cardSub}>
          Weighted composite. Green / yellow / red drive routing.
        </div>
        <table className={styles.signalTable}>
          <thead>
            <tr><th>Signal</th><th>Weight</th><th>Source</th><th>Availability</th></tr>
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

      <section className={styles.summaryCard}>
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

      <section className={styles.summaryCard}>
        <div className={styles.cardTitle}>Playbooks</div>
        <div className={styles.playbooks}>
          {plan.playbooks.map((pb) => (
            <div key={pb.id} className={styles.playbook}>
              <div className={styles.playbookTitle}>{pb.title}</div>
              <div className={styles.playbookGoal}>{pb.goal}</div>
              <div className={styles.playbookLabel}>Triggers</div>
              <ul className={styles.playbookList}>
                {pb.triggers.map((t, i) => <li key={i}>{t}</li>)}
              </ul>
              <div className={styles.playbookLabel}>Steps</div>
              <ol className={styles.playbookList}>
                {pb.steps.map((s, i) => <li key={i}>{s}</li>)}
              </ol>
              <div className={styles.playbookOwner}>
                Owner: <b>{pb.owner}</b>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.summaryCard}>
        <div className={styles.cardTitle}>CSM routing rules</div>
        <ul className={styles.routingList}>
          {plan.routingRules.map((r, i) => <li key={i}>{r}</li>)}
        </ul>
      </section>

      <section className={styles.summaryCard}>
        <div className={styles.cardTitle}>Process automations</div>
        <div className={styles.cardSub}>Tailored to the CRM of record.</div>
        {plan.automations.map((a) => (
          <div key={a.name} className={styles.automation}>
            <div className={styles.automationHeader}>
              <span className={styles.automationName}>{a.name}</span>
              <span className={styles.systemBadge}>{a.system}</span>
            </div>
            <div className={styles.automationField}><b>Trigger</b> {a.trigger}</div>
            <div className={styles.automationField}><b>Action</b> {a.action}</div>
            <div className={styles.automationField}><b>Recipient</b> {a.recipient}</div>
          </div>
        ))}
      </section>

      <section className={styles.summaryCard}>
        <div className={styles.cardTitle}>4-phase implementation</div>
        <div className={styles.cardSub}>Typically 60-100 hours end to end.</div>
        {plan.phases.map((phase) => (
          <div key={phase.id} className={styles.phaseSummary}>
            <div className={styles.phaseSummaryHeader}>
              <span className={styles.phaseSummaryName}>{phase.name}</span>
              <span className={styles.phaseHours}>{phase.hours[0]}–{phase.hours[1]} hrs</span>
            </div>
            <div className={styles.phaseMilestone}>
              <b>Milestone:</b> {phase.expectedMilestone}
            </div>
            <ul className={styles.phaseSummaryTasks}>
              {phase.tasks.map((t) => (
                <li key={t.id}>
                  <span>{t.label}</span>
                  <span className={styles.phaseTaskMeta}>
                    {t.owner} · {t.hours}h
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section className={styles.summaryCard}>
        <div className={styles.cardTitle}>Success metrics</div>
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
        <button className={`${styles.btn} ${styles.btnGhost}`} onClick={onBack}>
          ← Back to summary
        </button>
      </div>
    </main>
  );
}

/* ============================ Confetti ============================ */

function Confetti() {
  const colors = ["#c5f59d", "#d9afd0", "#6b3d77", "#fbbf24", "#10b981", "#fff"];
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
