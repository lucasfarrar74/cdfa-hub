import { describe, it, expect, vi } from 'vitest';
import { fetchBuildTimestamp, isNewerVersion } from './useBuildVersionCheck';

function mockFetchResponse(body: unknown, ok = true): typeof fetch {
  return vi.fn(async () => ({
    ok,
    json: async () => body,
  })) as unknown as typeof fetch;
}

describe('isNewerVersion', () => {
  it('returns false when remote is null', () => {
    expect(isNewerVersion(null, '2026-04-20T12:00:00Z')).toBe(false);
  });

  it('returns false when remote equals local', () => {
    expect(isNewerVersion('2026-04-20T12:00:00Z', '2026-04-20T12:00:00Z')).toBe(false);
  });

  it('returns true when remote differs from local', () => {
    expect(isNewerVersion('2026-04-20T13:00:00Z', '2026-04-20T12:00:00Z')).toBe(true);
  });
});

describe('fetchBuildTimestamp', () => {
  it('returns the timestamp from a successful response', async () => {
    const fetchImpl = mockFetchResponse({ buildTimestamp: '2026-04-20T12:00:00Z' });
    expect(await fetchBuildTimestamp(fetchImpl)).toBe('2026-04-20T12:00:00Z');
  });

  it('returns null when the response is not ok', async () => {
    const fetchImpl = mockFetchResponse({}, false);
    expect(await fetchBuildTimestamp(fetchImpl)).toBeNull();
  });

  it('returns null when fetch throws', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;
    expect(await fetchBuildTimestamp(fetchImpl)).toBeNull();
  });

  it('returns null when payload lacks buildTimestamp', async () => {
    const fetchImpl = mockFetchResponse({ somethingElse: 'nope' });
    expect(await fetchBuildTimestamp(fetchImpl)).toBeNull();
  });
});
