import type { Project } from '../types';

/**
 * Add cloud projects returned by the cross-device discovery query into
 * the local project list, without ever clobbering a local copy.
 *
 * The rule is deliberately conservative: if a discovered project's
 * `shareId` already exists locally (either it originated on this device
 * or a Firestore snapshot has already landed for it), we keep whatever
 * is local — the running Firestore subscription is the authoritative
 * source for live edits, so overwriting local from a one-shot list
 * query could stomp fresher state.
 *
 * Returns `{ merged, additions }`:
 *   - `merged` is the combined project list (or the same reference as
 *     `local` when nothing changed, so callers can no-op cheaply)
 *   - `additions` is the list of discovered projects actually added,
 *     useful for surfacing an "Added N cloud projects" toast
 */
export function mergeDiscoveredProjects(
  local: Project[],
  discovered: Project[],
): { merged: Project[]; additions: Project[] } {
  if (discovered.length === 0) {
    return { merged: local, additions: [] };
  }

  const localShareIds = new Set(
    local.map(p => p.shareId).filter((s): s is string => typeof s === 'string' && s.length > 0),
  );

  const additions: Project[] = [];
  const seenDiscoveredShareIds = new Set<string>();
  for (const d of discovered) {
    if (!d.shareId) continue;
    if (localShareIds.has(d.shareId)) continue;
    if (seenDiscoveredShareIds.has(d.shareId)) continue;
    seenDiscoveredShareIds.add(d.shareId);
    additions.push({ ...d, isCloud: true });
  }

  if (additions.length === 0) {
    return { merged: local, additions: [] };
  }

  return { merged: [...local, ...additions], additions };
}
