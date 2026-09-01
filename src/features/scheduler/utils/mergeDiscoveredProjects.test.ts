import { describe, it, expect } from 'vitest';
import { mergeDiscoveredProjects } from './mergeDiscoveredProjects';
import type { Project } from '../types';

function makeProject(overrides: Partial<Project> = {}): Project {
  const id = overrides.id ?? 'p1';
  return {
    id,
    name: overrides.name ?? `Project ${id}`,
    createdAt: overrides.createdAt ?? '2024-01-01T00:00:00Z',
    updatedAt: overrides.updatedAt ?? '2024-01-01T00:00:00Z',
    eventConfig: overrides.eventConfig ?? null,
    suppliers: overrides.suppliers ?? [],
    buyers: overrides.buyers ?? [],
    meetings: overrides.meetings ?? [],
    timeSlots: overrides.timeSlots ?? [],
    unscheduledPairs: overrides.unscheduledPairs ?? [],
    ...overrides,
  };
}

describe('mergeDiscoveredProjects', () => {
  it('returns local unchanged when discovered is empty', () => {
    const local = [makeProject({ id: 'p1' })];
    const { merged, additions } = mergeDiscoveredProjects(local, []);
    expect(merged).toBe(local); // reference-equal — cheap no-op
    expect(additions).toEqual([]);
  });

  it('adds a discovered project when its shareId is not present locally', () => {
    const local = [makeProject({ id: 'local1' })];
    const discovered = [makeProject({ id: 'cloud1', shareId: 'abcd1234' })];
    const { merged, additions } = mergeDiscoveredProjects(local, discovered);
    expect(merged.length).toBe(2);
    expect(additions.length).toBe(1);
    expect(additions[0].shareId).toBe('abcd1234');
    // The addition should be marked isCloud so the sidebar shows the badge.
    expect(additions[0].isCloud).toBe(true);
  });

  it('does NOT add a discovered project whose shareId already exists locally', () => {
    // Local copy has the same shareId — probably originated here and is
    // already being live-synced. We keep local; discovery is a fallback,
    // not an authority.
    const local = [makeProject({ id: 'local1', shareId: 'abcd1234', name: 'Local Name' })];
    const discovered = [makeProject({ id: 'cloud1', shareId: 'abcd1234', name: 'Cloud Name' })];
    const { merged, additions } = mergeDiscoveredProjects(local, discovered);
    expect(merged).toBe(local); // reference-equal, no changes
    expect(additions).toEqual([]);
    expect(merged[0].name).toBe('Local Name'); // local wasn't overwritten
  });

  it('skips discovered projects without a shareId (defensive)', () => {
    const local = [makeProject({ id: 'local1' })];
    const discovered = [makeProject({ id: 'cloud1' /* no shareId */ })];
    const { merged, additions } = mergeDiscoveredProjects(local, discovered);
    expect(merged).toBe(local);
    expect(additions).toEqual([]);
  });

  it('dedupes discovered by shareId (e.g. owner and collaborator queries overlap)', () => {
    const local = [makeProject({ id: 'local1' })];
    const discovered = [
      makeProject({ id: 'cloud1', shareId: 'shareA' }),
      makeProject({ id: 'cloud2', shareId: 'shareA' }), // dup from other query
      makeProject({ id: 'cloud3', shareId: 'shareB' }),
    ];
    const { merged, additions } = mergeDiscoveredProjects(local, discovered);
    expect(additions.length).toBe(2);
    expect(additions.map(a => a.shareId).sort()).toEqual(['shareA', 'shareB']);
    expect(merged.length).toBe(3);
  });

  it('preserves the order of local projects and appends additions in discovery order', () => {
    const local = [
      makeProject({ id: 'local1' }),
      makeProject({ id: 'local2' }),
    ];
    const discovered = [
      makeProject({ id: 'cloud1', shareId: 'shareA' }),
      makeProject({ id: 'cloud2', shareId: 'shareB' }),
    ];
    const { merged } = mergeDiscoveredProjects(local, discovered);
    expect(merged.map(p => p.id)).toEqual(['local1', 'local2', 'cloud1', 'cloud2']);
  });

  it('handles a purely fresh device (no local projects) by returning discovered as-is', () => {
    const discovered = [
      makeProject({ id: 'cloud1', shareId: 'shareA' }),
      makeProject({ id: 'cloud2', shareId: 'shareB' }),
    ];
    const { merged, additions } = mergeDiscoveredProjects([], discovered);
    expect(merged.length).toBe(2);
    expect(additions.length).toBe(2);
    expect(merged.every(p => p.isCloud)).toBe(true);
  });
});
