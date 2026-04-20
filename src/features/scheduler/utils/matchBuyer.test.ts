import { describe, it, expect } from 'vitest';
import { findBestBuyerMatch } from './matchBuyer';

const candidates = [
  { id: 'b1', name: 'Alice Smith', organization: 'Acme Corp' },
  { id: 'b2', name: 'Bob Jones', organization: 'Widget Co' },
  { id: 'b3', name: 'Carol Chen', organization: 'Global Foods Inc' },
];

describe('findBestBuyerMatch', () => {
  it('returns null for empty input', () => {
    expect(findBestBuyerMatch(candidates, '')).toBeNull();
    expect(findBestBuyerMatch(candidates, '   ')).toBeNull();
  });

  it('matches on exact name', () => {
    expect(findBestBuyerMatch(candidates, 'Alice Smith')?.id).toBe('b1');
  });

  it('matches on exact organization', () => {
    expect(findBestBuyerMatch(candidates, 'Widget Co')?.id).toBe('b2');
  });

  it('normalizes case and trailing punctuation that does not join tokens', () => {
    // "ACME CORP." → "acme corp" matches "Acme Corp"
    expect(findBestBuyerMatch(candidates, 'ACME CORP.')?.id).toBe('b1');
    expect(findBestBuyerMatch(candidates, '  Bob Jones  ')?.id).toBe('b2');
  });

  it('uses token similarity when no exact match is found', () => {
    expect(findBestBuyerMatch(candidates, 'Global Foods')?.id).toBe('b3');
  });

  it('returns null when no candidate scores above threshold', () => {
    expect(findBestBuyerMatch(candidates, 'Completely Unrelated Xyz')).toBeNull();
  });

  it('matches on combined org + name format', () => {
    expect(findBestBuyerMatch(candidates, 'Acme Corp Alice Smith')?.id).toBe('b1');
  });

  it('uses the organization hint when provided', () => {
    // Name is ambiguous, but org hint disambiguates
    const match = findBestBuyerMatch(candidates, 'Jones', 'Widget Co');
    expect(match?.id).toBe('b2');
  });

  it('returns null for empty candidate list', () => {
    expect(findBestBuyerMatch([], 'Anything')).toBeNull();
  });
});
