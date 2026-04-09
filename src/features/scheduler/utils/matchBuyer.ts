/**
 * Shared buyer matching utility for preference form import.
 * Used by both Excel and Word parsing paths.
 */

/** Normalize a string for comparison: lowercase, strip punctuation, collapse whitespace. */
function normalize(s: string): string {
  return s.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
}

/** Token-overlap similarity (Jaccard on word tokens), returns 0–1. */
function tokenSimilarity(a: string, b: string): number {
  const tokensA = new Set(normalize(a).split(' ').filter(Boolean));
  const tokensB = new Set(normalize(b).split(' ').filter(Boolean));
  if (tokensA.size === 0 && tokensB.size === 0) return 0;
  const intersection = new Set([...tokensA].filter(t => tokensB.has(t)));
  const union = new Set([...tokensA, ...tokensB]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

export interface BuyerMatchCandidate {
  id: string;
  name: string;
  organization: string;
}

/**
 * Find the best-matching buyer given a name string and optional org string.
 * Tries exact match first, then normalized match, then token similarity.
 * Returns null if no match scores above threshold (0.5).
 */
export function findBestBuyerMatch(
  candidates: BuyerMatchCandidate[],
  nameFromForm: string,
  orgFromForm?: string,
): BuyerMatchCandidate | null {
  if (!nameFromForm.trim()) return null;

  const normInput = normalize(nameFromForm);
  const normOrg = orgFromForm ? normalize(orgFromForm) : '';

  // Pass 1: exact normalized match on name OR organization
  for (const b of candidates) {
    if (normalize(b.name) === normInput || normalize(b.organization) === normInput) return b;
    if (normOrg && (normalize(b.organization) === normOrg || normalize(b.name) === normOrg)) return b;
  }

  // Pass 2: combined field match — handle "OrgName (ContactName)" patterns
  for (const b of candidates) {
    const combined1 = normalize(`${b.organization} ${b.name}`);
    const combined2 = normalize(`${b.name} ${b.organization}`);
    if (normInput === combined1 || normInput === combined2) return b;
  }

  // Pass 3: token similarity (best score wins, must exceed 0.5 threshold)
  let bestScore = 0;
  let bestMatch: BuyerMatchCandidate | null = null;

  for (const b of candidates) {
    const scores = [
      tokenSimilarity(nameFromForm, b.name),
      tokenSimilarity(nameFromForm, b.organization),
      tokenSimilarity(nameFromForm, `${b.organization} ${b.name}`),
    ];
    if (orgFromForm) {
      scores.push(tokenSimilarity(orgFromForm, b.organization));
      scores.push(tokenSimilarity(orgFromForm, b.name));
    }
    const maxScore = Math.max(...scores);
    if (maxScore > bestScore) {
      bestScore = maxScore;
      bestMatch = b;
    }
  }

  return bestScore >= 0.5 ? bestMatch : null;
}
