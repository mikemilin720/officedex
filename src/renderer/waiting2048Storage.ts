export const WAITING_2048_STORAGE_KEY = "officedex:waiting-2048";

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function loadWaiting2048BestScore(): number {
  const store = storage();
  const raw = store?.getItem(WAITING_2048_STORAGE_KEY);
  if (!raw) return 0;
  try {
    const parsed = JSON.parse(raw) as { bestScore?: unknown };
    const bestScore = typeof parsed.bestScore === "number" ? parsed.bestScore : 0;
    return Number.isFinite(bestScore) && bestScore > 0 ? Math.floor(bestScore) : 0;
  } catch {
    return 0;
  }
}

export function saveWaiting2048BestScore(score: number): number {
  const normalized = Number.isFinite(score) && score > 0 ? Math.floor(score) : 0;
  const current = loadWaiting2048BestScore();
  const next = Math.max(current, normalized);
  const store = storage();
  if (store) {
    store.setItem(WAITING_2048_STORAGE_KEY, JSON.stringify({ bestScore: next }));
  }
  return next;
}
