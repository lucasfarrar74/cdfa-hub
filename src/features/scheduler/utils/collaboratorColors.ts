/**
 * Stable per-collaborator color assignment. Derived from a hash of the
 * user id so the same user gets the same color everywhere (presence
 * dots, activity log avatars, live-change toasts) without needing a
 * lookup table stored anywhere.
 *
 * Palette is picked to stay distinct on both light and dark grounds
 * and to avoid collision with the app's error/warning/success accents
 * (red / amber / green — reserved for their meanings).
 */

const PALETTE = [
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#06b6d4', // cyan-500
  '#f97316', // orange-500 (distinct from amber warning)
  '#14b8a6', // teal-500
  '#a855f7', // purple-500
  '#3b82f6', // blue-500
  '#eab308', // yellow-500
];

/** Cheap deterministic hash of a string to a non-negative integer. */
function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

/** Color hex for a given user id. Stable across sessions and devices. */
export function colorForCollaborator(userId: string): string {
  if (!userId) return PALETTE[0];
  return PALETTE[hashString(userId) % PALETTE.length];
}

/**
 * Short label for a collaborator — first char of their display name,
 * uppercased. Falls back to the first char of their uid when there's
 * no name. Used inside presence dots.
 */
export function initialForCollaborator(displayName: string | null | undefined, userId: string): string {
  const source = (displayName || userId || '?').trim();
  return (source[0] || '?').toUpperCase();
}
