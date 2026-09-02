import type { Meeting, Project } from '../types';
import { detectFirstDoubleBooking } from './conflictDetection';

/**
 * Decision returned by `computeSyncOutcome` — the pure heart of the
 * Firestore transaction that guards cloud writes.
 *
 * - `proceed`          — safe to write; server revision matches our
 *                        base and the outgoing meetings pass the
 *                        double-booking guard.
 * - `conflict`         — server revision has advanced past what we last
 *                        observed. A teammate saved first; reject the
 *                        write, surface a red toast, let onSnapshot
 *                        bring fresh state in.
 * - `would-double-book`— the outgoing meetings themselves contain a
 *                        stack. Should never happen if the write-time
 *                        guards held, but this is the last line of
 *                        defence inside the transaction.
 */
export type SyncOutcome = 'proceed' | 'conflict' | 'would-double-book';

/**
 * Read the revision counter off a Project, defaulting to 0 for
 * pre-existing projects that were uploaded before the field existed.
 * Centralised so every consumer (client, transaction, tests) uses the
 * same coercion rules.
 */
export function getProjectRevision(
  project: Pick<Project, 'revision'> | null | undefined,
): number {
  if (!project) return 0;
  const v = project.revision;
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

/**
 * Pure decision function used inside the Firestore transaction. Kept
 * separate from the transaction wiring so it can be unit-tested
 * without touching Firebase.
 */
export function computeSyncOutcome(
  baseRevision: number,
  serverRevision: number,
  outgoingMeetings: Meeting[],
): SyncOutcome {
  if (serverRevision !== baseRevision) return 'conflict';
  if (detectFirstDoubleBooking(outgoingMeetings)) return 'would-double-book';
  return 'proceed';
}
