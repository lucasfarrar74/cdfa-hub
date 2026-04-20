import { useEffect, useState } from 'react';

const CHECK_INTERVAL_MS = 60_000;

export interface VersionCheckResult {
  newVersionAvailable: boolean;
  // Exposed for tests and for callers that want to short-circuit polling.
  check: () => Promise<void>;
}

/**
 * Fetch the deployed build timestamp from /version.json. Returns null when
 * the request fails or the response is malformed — the caller should treat
 * null as "nothing to announce" rather than a staleness signal.
 *
 * Accepts an injectable fetch for tests.
 */
export async function fetchBuildTimestamp(
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  try {
    const res = await fetchImpl('/version.json', { cache: 'no-store' });
    if (!res.ok) return null;
    const data = (await res.json()) as { buildTimestamp?: string };
    return data.buildTimestamp ?? null;
  } catch {
    return null;
  }
}

/** True when `remote` is a real timestamp that differs from `local`. */
export function isNewerVersion(remote: string | null, local: string): boolean {
  return !!remote && remote !== local;
}

/**
 * Polls /version.json every 60 seconds and compares the returned build
 * timestamp to the one baked into this bundle. When they differ, the user
 * is running older code than what's currently deployed.
 */
export function useBuildVersionCheck(): VersionCheckResult {
  const [newVersionAvailable, setNewVersionAvailable] = useState(false);

  const check = async () => {
    const remote = await fetchBuildTimestamp();
    if (isNewerVersion(remote, __BUILD_TIMESTAMP__)) {
      setNewVersionAvailable(true);
    }
  };

  useEffect(() => {
    let active = true;
    const run = async () => {
      if (!active) return;
      await check();
    };

    run();
    const intervalId = setInterval(run, CHECK_INTERVAL_MS);

    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, []);

  return { newVersionAvailable, check };
}
