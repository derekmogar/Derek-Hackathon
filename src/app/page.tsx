"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { computeChurnImpact, formatCurrency } from "@/lib/churnImpact";
import { generatePlan } from "@/lib/planGenerator";
import { questions, type Question } from "@/lib/questions";
import { emptyBlueprint, type Blueprint, type Motion, type Stage } from "@/lib/types";
import styles from "./page.module.css";

const STORAGE_KEY = "retention-engine:v1";

type PersistedState = {
  blueprint: Blueprint;
  tasksDone: Record<string, boolean>;
  stage: Stage;
  qIndex: number;
};

export default function Home() {
  const [stage, setStage] = useState<Stage>("blueprint");
  const [blueprint, setBlueprint] = useState<Blueprint>(emptyBlueprint);
  const [qIndex, setQIndex] = useState(0);
  const [tasksDone, setTasksDone] = useState<Record<string, boolean>>({});
  const [loadedFromStorage, setLoadedFromStorage] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  // Load from localStorage after mount (avoid SSR mismatch)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as PersistedState;
        setBlueprint({ ...emptyBlueprint, ...parsed.blueprint });
        setTasksDone(parsed.tasksDone || {});
        setStage(parsed.stage || "blueprint");
        setQIndex(parsed.qIndex || 0);
      }
    } catch {
      // ignore
    }
    setLoadedFromStorage(true);
  }, []);

  // Persist (only after initial load, to avoid overwriting with empties on mount)
  useEffect(() => {
    if (!loadedFromStorage) return;
    const payload: PersistedState = { blueprint, tasksDone, stage, qIndex };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [blueprint, tasksDone, stage, qIndex, loadedFromStorage]);

  const impact = useMemo(() => computeChurnImpact(blueprint), [blueprint]);
  const plan = useMemo(
    () => (stage !== "blueprint" ? generatePlan(blueprint) : null),
    [blueprint, stage],
  );

  const answered = questions.filter((q) => isAnswered(q, blueprint)).length;
  const blueprintComplete = answered === questions.length;

  const updateBlueprint = <K extends keyof Blueprint>(key: K, value: Blueprint[K]) => {
    setBlueprint((prev) => ({ ...prev, [key]: value }));
  };

  const toggleMotion = (m: Motion) => {
    setBlueprint((prev) => {
      const has = prev.motions.includes(m);
      return {
        ...prev,
        motions: has ? prev.motions.filter((x) => x !== m) : [...prev.motions, m],
      };
    });
  };

  const goPlan = () => setStage("plan");
  const goBuild = () => setStage("build");
  const goComplete = () => {
    setStage("complete");
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 4000);
  };

  const resetAll = () => {
    if (!confirm("Clear all answers and start over?")) return;
    localStorage.removeItem(STORAGE_KEY);
    setBlueprint(emptyBlueprint);
    setTasksDone({});
    setStage("blueprint");
    setQIndex(0);
  };

  const allTasks = plan ? plan.phases.flatMap((p) => p.tasks.map((t) => t.id)) : [];
  const doneCount = allTasks.filter((id) => tasksDone[id]).length;
  const buildComplete = allTasks.length > 0 && doneCount === allTasks.length;

  return (
    <div className={styles.shell}>
      {showConfetti && <Confetti />}

      <header className={styles.topbar}>
        <div className={styles.brand}>
          <div className={styles.brandMark}>RE</div>
          <div>
            <div>The Retention Engine</div>
            <div className={styles.topbarRight} style={{ marginTop: 2 }}>
              Renewal Management Plan Builder
            </div>
          </div>
        </div>
        <button
          className={`${styles.btn} ${styles.btnGhost} no-print`}
          style={{ color: "#fff", borderColor: "rgba(255,255,255,0.2)" }}
          onClick={resetAll}
        >
          Reset
        </button>
      </header>

      <nav className={styles.stageBar}>
        <StageChip
          num={1}
          label="Blueprint"
          active={stage === "blueprint"}
          done={blueprintComplete && stage !== "blueprint"}
          onClick={() => setStage("blueprint")}
        />
        <span className={styles.stageConnector} />
        <StageChip
          num={2}
          label="Plan"
          active={stage === "plan"}
          done={stage === "build" || stage === "complete"}
          disabled={!blueprintComplete}
          onClick={() => blueprintComplete && setStage("plan")}
        />
        <span className={styles.stageConnector} />
        <StageChip
          num={3}
          label="Build"
          active={stage === "build"}
          done={stage === "complete"}
          disabled={!blueprintComplete}
          onClick={() => blueprintComplete && setStage("build")}
        />
        <span className={styles.stageConnector} />
        <StageChip
          num={4}
          label="Complete"
          active={stage === "complete"}
          disabled={!buildComplete}
          onClick={() => buildComplete && goComplete()}
        />
      </nav>

      <main
        className={`${styles.main} ${stage === "blueprint" ? styles.blueprintGrid : ""}`}
      >
        {stage === "blueprint" && (
          <>
            <div>
              {qIndex === 0 && <Hero impact={impact} answered={answered} />}
              <BlueprintCard
                question={questions[qIndex]}
                blueprint={blueprint}
                onAnswer={updateBlueprint}
                onToggleMotion={toggleMotion}
                qIndex={qIndex}
                total={questions.length}
                onPrev={() => setQIndex(Math.max(0, qIndex - 1))}
                onNext={() => {
                  if (qIndex < questions.length - 1) {
                    setQIndex(qIndex + 1);
                  } else if (blueprintComplete) {
                    goPlan();
                  }
                }}
                canProceed={isAnswered(questions[qIndex], blueprint)}
              />
            </div>
            <ChurnScorecard impact={impact} answered={answered} total={questions.length} />
          </>
        )}

        {stage === "plan" && plan && (
          <PlanView plan={plan} onContinue={goBuild} />
        )}

        {stage === "build" && plan && (
          <BuildStage
            plan={plan}
            tasksDone={tasksDone}
            onToggle={(id) =>
              setTasksDone((prev) => ({ ...prev, [id]: !prev[id] }))
            }
            onComplete={goComplete}
            canComplete={buildComplete}
          />
        )}

        {stage === "complete" && plan && (
          <CompleteStage plan={plan} onRestart={resetAll} />
        )}
      </main>
    </div>
  );
}

/* ----------------------------- Helpers ----------------------------- */

function isAnswered(q: Question, bp: Blueprint): boolean {
  if (q.id === "motions") return bp.motions.length > 0;
  if (q.id === "currentGrr") return true; // optional — can be null
  return bp[q.id] !== null;
}

/* ----------------------------- Sub-components ----------------------------- */

function StageChip({
  num,
  label,
  active,
  done,
  disabled,
  onClick,
}: {
  num: number;
  label: string;
  active?: boolean;
  done?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      className={`${styles.stageChip} ${active ? styles.active : ""} ${done ? styles.done : ""}`}
      disabled={disabled}
      onClick={onClick}
    >
      <span className={styles.stageNum}>{done ? "✓" : num}</span>
      {label}
    </button>
  );
}

function Hero({ impact, answered }: { impact: ReturnType<typeof computeChurnImpact>; answered: number }) {
  return (
    <section className={styles.hero}>
      <div className={styles.heroEyebrow}>Renewal Management · Micro-App</div>
      <h1 className={styles.heroTitle}>
        Design the renewal system that <em>reduces churn</em>.
      </h1>
      <p className={styles.heroSub}>
        Answer {questions.length} questions about your current renewal process.
        We'll generate a tailored plan with staging, health scoring, playbooks, CSM
        routing, and the specific automations to ship it — tuned to your CRM and
        team. Churn impact recalculates live as you answer.
      </p>
      <div className={styles.heroStats}>
        <div className={styles.heroStat}>
          <div className={styles.heroStatNum}>+{impact.grrLiftPoints}pp</div>
          <div className={styles.heroStatLabel}>Projected GRR lift</div>
        </div>
        <div className={styles.heroStat}>
          <div className={styles.heroStatNum}>
            {formatCurrency(impact.arrSavedPerYear)}
          </div>
          <div className={styles.heroStatLabel}>ARR saved / year</div>
        </div>
        <div className={styles.heroStat}>
          <div className={styles.heroStatNum}>{answered}/{questions.length}</div>
          <div className={styles.heroStatLabel}>Blueprint complete</div>
        </div>
      </div>
    </section>
  );
}

function ChurnScorecard({
  impact,
  answered,
  total,
}: {
  impact: ReturnType<typeof computeChurnImpact>;
  answered: number;
  total: number;
}) {
  const pct = Math.round((answered / total) * 100);
  return (
    <aside className={styles.scorecard}>
      <div className={styles.scorecardTitle}>
        <span className={styles.livePulse} /> Live churn impact
      </div>

      <div className={styles.scoreRow}>
        <span className={styles.scoreLabel}>Current GRR</span>
        <span className={styles.scoreValue}>{impact.currentGrr}%</span>
      </div>

      <div className={styles.scoreRow}>
        <span className={styles.scoreLabel}>Projected GRR</span>
        <span className={`${styles.scoreValue} ${styles.lift}`}>
          {impact.projectedGrr}%
          {impact.grrLiftPoints > 0 && (
            <span className={styles.scoreDelta}>
              +{impact.grrLiftPoints}pp
            </span>
          )}
        </span>
      </div>

      <div className={styles.scoreRow}>
        <span className={styles.scoreLabel}>ARR saved / year</span>
        <span className={`${styles.scoreValue} ${styles.lift}`}>
          {formatCurrency(impact.arrSavedPerYear)}
        </span>
      </div>

      <div className={styles.scoreRow}>
        <span className={styles.scoreLabel}>Surprise churn</span>
        <span className={styles.scoreValue}>
          <span className={styles.drop}>{impact.currentSurpriseChurn}%</span>
          <span style={{ color: "var(--muted)", margin: "0 8px", fontSize: "0.9rem" }}>→</span>
          <span className={styles.lift}>{impact.projectedSurpriseChurn}%</span>
        </span>
      </div>

      <div className={styles.scoreRow}>
        <span className={styles.scoreLabel}>Risk detection</span>
        <span className={styles.scoreValue} style={{ fontSize: "0.85rem", fontWeight: 600 }}>
          {impact.timeToRiskDetection}
        </span>
      </div>

      <div className={styles.scoreFootnote}>
        Updates as you answer. Based on B2B SaaS retention benchmarks (Benchmarkit
        2024, Bain research) mapped through the LeanScale Renewal Management
        playbook. Blueprint {pct}% complete.
      </div>
    </aside>
  );
}

function BlueprintCard({
  question,
  blueprint,
  onAnswer,
  onToggleMotion,
  qIndex,
  total,
  onPrev,
  onNext,
  canProceed,
}: {
  question: Question;
  blueprint: Blueprint;
  onAnswer: <K extends keyof Blueprint>(k: K, v: Blueprint[K]) => void;
  onToggleMotion: (m: Motion) => void;
  qIndex: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  canProceed: boolean;
}) {
  const progress = ((qIndex + 1) / total) * 100;
  const isLast = qIndex === total - 1;

  return (
    <section className={`${styles.card}`} style={{ marginTop: qIndex === 0 ? "var(--space-5)" : 0 }}>
      <div className={styles.qHeader}>
        <span className={styles.qCount}>
          Question {qIndex + 1} of {total}
        </span>
        <div className={styles.progress}>
          <div className={styles.progressFill} style={{ width: `${progress}%` }} />
        </div>
      </div>

      <h2 className={styles.qPrompt}>{question.prompt}</h2>
      <p className={styles.qHelp}>{question.help}</p>

      {question.kind === "single" && (
        <div
          className={`${styles.options} ${
            question.options.length === 2 ? styles.two : question.options.length === 3 ? styles.three : ""
          }`}
        >
          {question.options.map((opt) => {
            const selected = blueprint[question.id] === opt.value;
            return (
              <button
                key={opt.value}
                className={`${styles.option} ${selected ? styles.selected : ""}`}
                onClick={() =>
                  onAnswer(question.id as keyof Blueprint, opt.value as Blueprint[keyof Blueprint])
                }
              >
                <div className={styles.optionLabel}>{opt.label}</div>
                {opt.sub && <div className={styles.optionSub}>{opt.sub}</div>}
              </button>
            );
          })}
        </div>
      )}

      {question.kind === "multi" && (
        <div className={styles.options}>
          {question.options.map((opt) => {
            const selected = blueprint.motions.includes(opt.value);
            return (
              <button
                key={opt.value}
                className={`${styles.option} ${selected ? styles.selected : ""}`}
                onClick={() => onToggleMotion(opt.value)}
              >
                <div className={styles.optionLabel}>
                  {selected ? "✓ " : ""}
                  {opt.label}
                </div>
                {opt.sub && <div className={styles.optionSub}>{opt.sub}</div>}
              </button>
            );
          })}
        </div>
      )}

      {question.kind === "grr" && (
        <GrrInput
          value={blueprint.currentGrr}
          onChange={(v) => onAnswer("currentGrr", v)}
        />
      )}

      <div className={styles.btnRow}>
        <button
          className={`${styles.btn} ${styles.btnGhost}`}
          onClick={onPrev}
          disabled={qIndex === 0}
        >
          ← Back
        </button>
        <button
          className={`${styles.btn} ${styles.btnPrimary} ${styles.btnLg}`}
          onClick={onNext}
          disabled={!canProceed}
        >
          {isLast ? "Generate plan →" : "Next →"}
        </button>
      </div>
    </section>
  );
}

function GrrInput({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  const isUnknown = value === null;
  const display = value ?? 90;
  return (
    <div>
      <div className={styles.grrInput}>
        <input
          type="range"
          min={70}
          max={100}
          step={0.5}
          value={display}
          onChange={(e) => onChange(Number(e.target.value))}
          disabled={isUnknown}
        />
        <div className={styles.grrValue}>{isUnknown ? "—" : `${display}%`}</div>
      </div>
      <label className={styles.grrUnknown}>
        <input
          type="checkbox"
          checked={isUnknown}
          onChange={(e) => onChange(e.target.checked ? null : 90)}
        />
        We don't know our GRR — use industry median (90%)
      </label>
    </div>
  );
}

/* ----------------------------- Plan view ----------------------------- */

function PlanView({
  plan,
  onContinue,
}: {
  plan: ReturnType<typeof generatePlan>;
  onContinue: () => void;
}) {
  return (
    <div style={{ display: "grid", gap: "var(--space-5)" }}>
      <section className={styles.planHeader}>
        <div>
          <div style={{ fontSize: "var(--text-xs)", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--ls-lime)", fontWeight: 700, marginBottom: 6 }}>
            Your Retention Engine Plan
          </div>
          <div style={{ fontSize: "var(--text-2xl)", fontWeight: 800, letterSpacing: "-0.02em" }}>
            Churn-impact forecast
          </div>
        </div>
        <button className={`${styles.btn} ${styles.btnLime} ${styles.btnLg} no-print`} onClick={onContinue}>
          Continue to Build →
        </button>
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
          <div className={styles.planStatLabel}>ARR Saved / Year</div>
          <div className={styles.planStatValue} style={{ color: "var(--retained)" }}>
            {formatCurrency(plan.impact.arrSavedPerYear)}
          </div>
          <div className={styles.planStatSub}>
            Assumes {formatCurrency(plan.impact.estimatedArr)} ARR base
          </div>
        </div>
        <div className={`${styles.planStat} ${styles.risk}`}>
          <div className={styles.planStatLabel}>Surprise Churn</div>
          <div className={styles.planStatValue}>
            {plan.impact.currentSurpriseChurn}% →{" "}
            <span style={{ color: "var(--retained)" }}>
              {plan.impact.projectedSurpriseChurn}%
            </span>
          </div>
          <div className={styles.planStatSub}>
            Share of churn with no prior flag
          </div>
        </div>
        <div className={`${styles.planStat} ${styles.retained}`}>
          <div className={styles.planStatLabel}>Risk Detection</div>
          <div className={styles.planStatValue} style={{ fontSize: "1.1rem", lineHeight: 1.3 }}>
            {plan.impact.timeToRiskDetection}
          </div>
          <div className={styles.planStatSub}>Lead time before renewal</div>
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
          <div style={{ lineHeight: 1.6, fontSize: "var(--text-base)" }}>
            {plan.approachRationale}
          </div>
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.cardTitle}>Priority gaps to close</div>
        <div className={styles.cardSub}>
          Ranked by churn impact, not effort. Closing the top 3 is typically
          where 70% of the retention lift lives.
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
          Weighted composite score. Recalculated nightly. Green / Yellow / Red
          thresholds drive intervention routing.
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
            Green — Healthy
          </div>
          <div className={`${styles.threshold} ${styles["thr-yellow"]}`}>
            <span className={styles.tn}>
              {plan.healthDesign.threshold.red}–{plan.healthDesign.threshold.yellow}
            </span>
            Yellow — Watch
          </div>
          <div className={`${styles.threshold} ${styles["thr-red"]}`}>
            <span className={styles.tn}>&lt;{plan.healthDesign.threshold.red}</span>
            Red — Intervene
          </div>
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.cardTitle}>90 / 60 / 30-day renewal cadence</div>
        <div className={styles.cardSub}>{plan.staging.ownerModel}</div>
        <div className={styles.cadence}>
          {plan.staging.cadence.map((c) => (
            <Fragment key={c.day}>
              <div
                className={`${styles.dayPill} ${c.day === 0 ? styles.d0 : ""}`}
              >
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
          Each playbook is a documented motion with triggers, steps, and owner
          — CSMs should run these the same way every time.
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
        <div className={styles.cardSub}>
          How renewals get assigned and escalated.
        </div>
        <ul className={styles.routingList}>
          {plan.routingRules.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      </section>

      <section className={styles.card}>
        <div className={styles.cardTitle}>Process automations</div>
        <div className={styles.cardSub}>
          Specific workflows to build — tailored to your CRM of record.
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
          What to instrument on day 1. Leading indicators tell you if the
          system is being used; lagging indicators tell you if it's working.
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
          Plan generated from your blueprint. Continue to build it step by step.
        </span>
        <button
          className={`${styles.btn} ${styles.btnPrimary} ${styles.btnLg} no-print`}
          onClick={onContinue}
        >
          Continue to Build →
        </button>
      </div>
    </div>
  );
}

/* ----------------------------- Build stage ----------------------------- */

function BuildStage({
  plan,
  tasksDone,
  onToggle,
  onComplete,
  canComplete,
}: {
  plan: ReturnType<typeof generatePlan>;
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
    <div style={{ display: "grid", gap: "var(--space-4)" }}>
      <section className={styles.card}>
        <div className={styles.cardTitle}>Implementation roadmap</div>
        <div className={styles.cardSub}>
          Four phases, typically 60–100 hours end-to-end. Check tasks off as
          you complete them — each phase has an expected retention milestone.
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
              <div
                className={styles.phaseProgressFill}
                style={{ width: `${phasePct}%` }}
              />
            </div>
          </section>
        );
      })}

      <div className={styles.btnRow}>
        <span style={{ color: "var(--muted)", fontSize: "var(--text-sm)" }}>
          {canComplete
            ? "All tasks complete — finish the engagement."
            : `${total - done} tasks remaining.`}
        </span>
        <button
          className={`${styles.btn} ${styles.btnLime} ${styles.btnLg}`}
          onClick={onComplete}
          disabled={!canComplete}
        >
          Complete engagement →
        </button>
      </div>
    </div>
  );
}

/* ----------------------------- Complete stage ----------------------------- */

function CompleteStage({
  plan,
  onRestart,
}: {
  plan: ReturnType<typeof generatePlan>;
  onRestart: () => void;
}) {
  return (
    <section className={styles.completeWrap}>
      <div className={styles.completeEyebrow}>Engagement Complete</div>
      <h1 className={styles.completeTitle}>
        The retention engine is live.
      </h1>
      <p className={styles.completeSub}>
        Projected GRR lift of <b>+{plan.impact.grrLiftPoints}pp</b> —
        approximately <b>{formatCurrency(plan.impact.arrSavedPerYear)}</b> in ARR
        retained per year. Surprise churn cut from{" "}
        <b>{plan.impact.currentSurpriseChurn}%</b> to{" "}
        <b>{plan.impact.projectedSurpriseChurn}%</b>. Measure against the success
        metrics in your plan at 30 / 60 / 90 days.
      </p>
      <div className={styles.completeActions}>
        <button
          className={`${styles.btn} ${styles.btnLime} ${styles.btnLg}`}
          onClick={() => window.print()}
        >
          Print / Save as PDF
        </button>
        <button
          className={`${styles.btn} ${styles.btnGhost} ${styles.btnLg}`}
          onClick={onRestart}
          style={{ color: "#fff", borderColor: "rgba(255,255,255,0.3)" }}
        >
          Start new engagement
        </button>
      </div>
    </section>
  );
}

/* ----------------------------- Confetti ----------------------------- */

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
