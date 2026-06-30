// GitHub Actions secrets can't be saved empty, so placeholder secrets often end up
// literally containing '' or "" — treat those the same as unset/blank.
const EMPTY_PLACEHOLDERS = new Set(["''", '""']);

/** Reads an env var, returning null for unset, blank, or quote-only placeholder values. */
export function getEnv(name: string): string | null {
  const raw = process.env[name];
  if (!raw) return null;

  const trimmed = raw.trim();
  if (!trimmed || EMPTY_PLACEHOLDERS.has(trimmed)) return null;

  return raw;
}
