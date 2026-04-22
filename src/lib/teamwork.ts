import { COMPONENT_INDEX } from "./components-catalog";
import type { Plan, SystemState } from "./types";

export type TeamworkTask = {
  id: string;
  taskList: string;
  title: string;
  description: string;
  owner: string;
  estimatedHours: number;
  priority: "high" | "normal" | "low";
};

/** Generate Teamwork-style task list from the implementation plan
 *  + per-component notes captured during discovery. */
export function generateTeamworkTasks(
  plan: Plan,
  state: SystemState,
): TeamworkTask[] {
  const tasks: TeamworkTask[] = [];

  for (const phase of plan.phases) {
    for (const t of phase.tasks) {
      tasks.push({
        id: `${phase.id}-${t.id}`,
        taskList: phase.name,
        title: t.label,
        description: `${phase.expectedMilestone}\n\nOwner: ${t.owner}\nEstimate: ${t.hours} hrs`,
        owner: t.owner,
        estimatedHours: t.hours,
        priority: phase.id === "strategy" ? "high" : "normal",
      });
    }
  }

  // Per-component follow-ups from gaps
  for (const gap of plan.gaps.slice(0, 5)) {
    tasks.push({
      id: `gap-${gap.id}`,
      taskList: "Priority Gaps — Architect Punch-list",
      title: gap.title,
      description: `${gap.rationale}\n\nProjected GRR lift: +${gap.churnImpactPoints}pp\nEffort: ${gap.effort}`,
      owner: "Architect",
      estimatedHours: gap.effort === "low" ? 3 : gap.effort === "medium" ? 8 : 16,
      priority: "high",
    });
  }

  // Capture notes from the call as follow-up tasks
  for (const [compId, note] of Object.entries(state.notes)) {
    if (!note?.trim()) continue;
    const comp = COMPONENT_INDEX[compId];
    if (!comp) continue;
    tasks.push({
      id: `note-${compId}`,
      taskList: "Discovery Call Follow-ups",
      title: `Review notes: ${comp.name}`,
      description: note.trim(),
      owner: "Architect",
      estimatedHours: 1,
      priority: "normal",
    });
  }

  return tasks;
}

export function formatTasksAsMarkdown(tasks: TeamworkTask[]): string {
  const grouped: Record<string, TeamworkTask[]> = {};
  for (const t of tasks) {
    grouped[t.taskList] = grouped[t.taskList] || [];
    grouped[t.taskList].push(t);
  }

  const lines: string[] = ["# Teamwork Task List Import\n"];
  for (const [listName, items] of Object.entries(grouped)) {
    const total = items.reduce((s, t) => s + t.estimatedHours, 0);
    lines.push(`## ${listName} _(${items.length} tasks · ${total} hrs)_\n`);
    for (const t of items) {
      lines.push(`- [ ] **${t.title}**`);
      lines.push(`  - Owner: ${t.owner}`);
      lines.push(`  - Estimate: ${t.estimatedHours} hrs · Priority: ${t.priority}`);
      if (t.description) {
        const desc = t.description.split("\n").map((l) => `  > ${l}`).join("\n");
        lines.push(desc);
      }
      lines.push("");
    }
  }
  return lines.join("\n");
}

export function formatDiscoveryNotes(state: SystemState): string {
  const lines: string[] = [];
  const client = state.context.clientName?.trim() || "Discovery Session";
  lines.push(`# ${client} — Renewal Management Discovery Notes`);
  lines.push(`_Captured ${new Date().toLocaleDateString()}_\n`);

  const notedComponents = Object.entries(state.notes).filter(
    ([, note]) => note?.trim(),
  );

  if (notedComponents.length === 0) {
    lines.push("_(No notes captured during discovery.)_");
    return lines.join("\n");
  }

  for (const [compId, note] of notedComponents) {
    const comp = COMPONENT_INDEX[compId];
    if (!comp) continue;
    const maturity = state.components[compId] ?? 0;
    lines.push(`## ${comp.name}`);
    lines.push(`**Layer:** ${comp.layer} · **Current maturity:** Level ${maturity}\n`);
    lines.push(note.trim());
    lines.push("");
  }

  if (state.hidden.length > 0) {
    lines.push("---\n");
    lines.push("## Marked not relevant\n");
    for (const id of state.hidden) {
      const comp = COMPONENT_INDEX[id];
      if (comp) lines.push(`- ${comp.name}`);
    }
  }

  return lines.join("\n");
}
