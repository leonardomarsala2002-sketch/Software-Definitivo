// Deno-compatible copy — identical logic to src/lib/scheduling-engine/lifecycle.ts

import type { ScheduleStatus } from "./types.ts";

const TRANSITIONS: Readonly<Record<ScheduleStatus, readonly ScheduleStatus[]>> = {
  draft:     ["generated", "archived"],
  generated: ["validated", "draft", "archived"],
  validated: ["published", "generated", "archived"],
  published: ["modified", "archived"],
  modified:  ["validated", "archived"],
  archived:  [],
};

export function canTransition(from: ScheduleStatus, to: ScheduleStatus): boolean {
  return (TRANSITIONS[from] as readonly string[]).includes(to);
}

export function transition(from: ScheduleStatus, to: ScheduleStatus): ScheduleStatus {
  if (!canTransition(from, to)) throw new Error(`Invalid schedule transition: ${from} → ${to}`);
  return to;
}

export function getAvailableTransitions(from: ScheduleStatus): readonly ScheduleStatus[] {
  return TRANSITIONS[from];
}

export function isPublishable(status: ScheduleStatus): boolean {
  return status === "validated";
}

export function generationRunStatusToLifecycle(runStatus: string): ScheduleStatus {
  switch (runStatus) {
    case "completed": return "generated";
    case "validated": return "validated";
    case "published": return "published";
    case "failed":    return "archived";
    default:          return "draft";
  }
}
