/**
 * Version and update-detection helpers.
 *
 * The bundle's own version is inlined at build time via `__APP_VERSION__`.
 * To learn whether a newer deploy has shipped, we fetch `/version.json`
 * with cache-busting and compare. If it differs from what this bundle was
 * built with, an update is available and the user is offered a reload.
 */

/** Version this bundle was built with. */
export const APP_VERSION: string = __APP_VERSION__;

/** First day of the current release, for display as "since <date>". */
export function releaseDate(version: string): string | null {
  // Version dates live in CHANGELOG.md; this is intentionally not derived from
  // the package version so that dates stay accurate for historical releases.
  return null;
}

const MANIFEST_URL = '/version.json';

/** Check interval. Frequent enough to be useful, rare enough to be invisible. */
const CHECK_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Compares semver-ish dotted versions.
 * Returns > 0 if `a` is newer than `b`, < 0 if older, 0 if equal or unparseable.
 */
export function compareVersions(a: string, b: string): number {
  const parse = (v: string) =>
    v
      .replace(/^v/, '')
      .split('-')[0]
      .split('.')
      .map((n) => parseInt(n, 10));

  const pa = parse(a);
  const pb = parse(b);

  if (pa.length === 0 || pb.length === 0 || pa.some(isNaN) || pb.some(isNaN)) {
    // Fall back to a plain equality check for non-numeric versions.
    return a === b ? 0 : -1;
  }

  const length = Math.max(pa.length, pb.length);
  for (let i = 0; i < length; i++) {
    const na = pa[i] ?? 0;
    const nb = pb[i] ?? 0;
    if (na !== nb) return na - nb;
  }
  return 0;
}

/**
 * Fetches the deployed manifest once, bypassing the CDN cache so we always
 * see the truth rather than a stale edge copy.
 */
export async function fetchRemoteVersion(): Promise<string | null> {
  try {
    const res = await fetch(`${MANIFEST_URL}?t=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (!res.ok) return null;
    const manifest = (await res.json()) as VersionManifest;
    return manifest?.version ?? null;
  } catch {
    return null;
  }
}

/**
 * Polls the deployed manifest and invokes `onUpdateAvailable` when the remote
 * version is newer than this bundle's.
 *
 * Polling pauses while the tab is hidden and resumes on focus, so an idle tab
 * does not keep polling in the background.
 */
export function watchForUpdates(onUpdateAvailable: (latest: string) => void): () => void {
  let stopped = false;

  const check = async () => {
    if (stopped || document.visibilityState === 'hidden') return;
    const remote = await fetchRemoteVersion();
    if (stopped) return;
    if (remote && compareVersions(remote, APP_VERSION) > 0) {
      onUpdateAvailable(remote);
    }
  };

  const timer = window.setInterval(check, CHECK_INTERVAL_MS);
  const onVisible = () => {
    if (document.visibilityState === 'visible') void check();
  };

  document.addEventListener('visibilitychange', onVisible);
  void check();

  return () => {
    stopped = true;
    window.clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisible);
  };
}

/**
 * Marks that an update is pending, so the banner persists across a reload
 * until the user actually takes it.
 */
export function persistPendingUpdate(latest: string): void {
  try {
    localStorage.setItem('atlas:pendingUpdate', latest);
  } catch {
    // Storage may be unavailable in private modes; the banner still works.
  }
}

export function readPendingUpdate(): string | null {
  try {
    return localStorage.getItem('atlas:pendingUpdate');
  } catch {
    return null;
  }
}

export function clearPendingUpdate(): void {
  try {
    localStorage.removeItem('atlas:pendingUpdate');
  } catch {
    // Ignore.
  }
}

/** Hard reload, bypassing the browser cache so the new bundle is fetched. */
export function applyUpdate(): void {
  // The flag lets the freshly loaded bundle tell the user it just updated,
  // rather than silently changing underneath them.
  window.__ATLAS_UPDATE_READY__ = true;
  try {
    clearPendingUpdate();
  } catch {
    // Ignore.
  }
  window.location.reload();
}