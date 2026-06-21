const KEY = "mymonta_last_visited";
const MAX = 12;

export function addToLastVisited(productId: string): void {
  try {
    const prev = getLastVisited();
    const next = [productId, ...prev.filter(id => id !== productId)].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
}

export function getLastVisited(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(id => typeof id === "string") : [];
  } catch {
    return [];
  }
}
