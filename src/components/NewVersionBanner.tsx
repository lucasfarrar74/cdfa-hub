import { useBuildVersionCheck } from '../hooks/useBuildVersionCheck';

/**
 * Non-dismissable banner shown when a newer app build is available on the
 * server than the one the user is running. Prompts a hard reload to pick up
 * the latest code — matters especially during live event collaboration, when
 * stale teammates would otherwise be invisible to each other.
 */
export function NewVersionBanner() {
  const { newVersionAvailable } = useBuildVersionCheck();

  if (!newVersionAvailable) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-amber-950 px-4 py-2 shadow-md flex items-center justify-center gap-4 text-sm">
      <span className="font-medium">
        A new version of CDFA Hub is available.
      </span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="rounded bg-amber-950 text-amber-50 px-3 py-1 text-xs font-semibold hover:bg-amber-900 transition-colors"
      >
        Refresh now
      </button>
    </div>
  );
}
