/**
 * Lightweight localStorage cache for OpenPortal report data.
 *
 * All entries are versioned — bumping CACHE_VERSION invalidates everything.
 * setCached evicts existing entries (largest first, oldest as a tiebreaker)
 * when the storage quota is exceeded, so callers never need to handle errors.
 */

import { DateTime } from 'luxon';

import { translate } from '@/i18n';

const CACHE_VERSION = 2;
const PREFIX = `openportal-v${CACHE_VERSION}-`;

/** TTL constants in milliseconds. */
export const TTL = {
  /** Report data is generated once per day — 24-hour TTL. */
  REPORTS: 24 * 60 * 60 * 1000,
  /** Project lists and accounting summaries — 1-hour TTL. */
  LISTS: 60 * 60 * 1000,
  /** Name mappings (offering / project / user) — 12-hour TTL. */
  MAPPINGS: 12 * 60 * 60 * 1000,
} as const;

interface CacheEntry<T> {
  data: T;
  cachedAt: number;
}

/**
 * Remove entries from a previous CACHE_VERSION. Without this, bumping the
 * version only makes old entries invisible to new code — they'd otherwise
 * sit in localStorage forever, still consuming quota.
 */
(function purgeStaleVersions() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith('openportal-v') && !k.startsWith(PREFIX))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    // localStorage unavailable — nothing to purge.
  }
})();

/**
 * Read a cached value. Returns null if the key is missing, expired, or
 * the stored JSON is malformed.
 */
export function getCached<T>(key: string, ttlMs: number): T | null {
  try {
    const raw = localStorage.getItem(`${PREFIX}${key}`);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry<T>;
    if (Date.now() - entry.cachedAt > ttlMs) {
      localStorage.removeItem(`${PREFIX}${key}`);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

/**
 * Return the timestamp at which the given key was cached, or null if absent.
 * Useful for displaying "loaded from cache X hours ago" notices.
 */
export function getCacheAge(key: string): Date | null {
  try {
    const raw = localStorage.getItem(`${PREFIX}${key}`);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry<unknown>;
    return new Date(entry.cachedAt);
  } catch {
    return null;
  }
}

interface StoredEntryMeta {
  key: string;
  size: number;
  cachedAt: number;
}

function listEntries(excludeKey: string): StoredEntryMeta[] {
  const entries: StoredEntryMeta[] = [];
  for (const key of Object.keys(localStorage)) {
    if (!key.startsWith(PREFIX) || key === excludeKey) continue;
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    let cachedAt = 0;
    try {
      cachedAt = (JSON.parse(raw) as CacheEntry<unknown>).cachedAt ?? 0;
    } catch {
      // Malformed entry — treat as oldest so it's evicted first among ties.
    }
    entries.push({ key, size: raw.length, cachedAt });
  }
  return entries;
}

/** Bounds the eviction loop if quota can never be satisfied for a single write. */
const MAX_EVICTIONS = 50;

/**
 * Evict the largest cache entry, breaking ties by oldest first. Never
 * evicts `keepKey` (the entry currently being written).
 * Returns false once there's nothing left to evict.
 */
function evictOne(keepKey: string): boolean {
  const entries = listEntries(keepKey);
  if (entries.length === 0) return false;
  entries.sort((a, b) => b.size - a.size || a.cachedAt - b.cachedAt);
  localStorage.removeItem(entries[0].key);
  return true;
}

/**
 * Persist data under `key`. If the storage quota is exceeded, evicts other
 * cache entries (largest first, oldest as a tiebreaker) and retries, so
 * callers never need to handle storage failures.
 *
 * Eviction is what makes it safe to keep caching whole report payloads: a
 * large write pushes out the biggest stale entries rather than being dropped
 * itself, so the small per-identifier mapping entries survive.
 */
export function setCached(key: string, data: unknown): void {
  const fullKey = `${PREFIX}${key}`;
  let serialized: string;
  try {
    const entry: CacheEntry<unknown> = { data, cachedAt: Date.now() };
    serialized = JSON.stringify(entry);
  } catch {
    // Serialisation error — continue without caching.
    return;
  }
  for (let attempt = 0; attempt <= MAX_EVICTIONS; attempt++) {
    try {
      localStorage.setItem(fullKey, serialized);
      return;
    } catch {
      if (!evictOne(fullKey)) return;
    }
  }
}

/**
 * Remove specific cache keys, or (with no arguments) clear all openportal
 * cache entries.
 */
export function clearCached(...keys: string[]): void {
  if (keys.length === 0) {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(PREFIX))
      .forEach((k) => localStorage.removeItem(k));
    return;
  }
  for (const key of keys) {
    localStorage.removeItem(`${PREFIX}${key}`);
  }
}

/**
 * Remove all per-identifier mapping cache entries (keys prefixed with
 * `map-`). Called by Refresh buttons so the next load re-fetches fresh
 * names from the API.
 */
export function clearMappingCache(): void {
  const mapPrefix = `${PREFIX}map-`;
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(mapPrefix))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore
  }
}

/** Format a cache age for display, e.g. "3 hr ago". */
export function formatCacheAge(cachedAt: Date): string {
  return (
    DateTime.fromJSDate(cachedAt).toRelative({ style: 'short' }) ??
    translate('just now')
  );
}
