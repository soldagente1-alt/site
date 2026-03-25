export function computeNextDueDate(dueDay, fromDate = new Date()) {
  const day = Number(dueDay);
  if (!Number.isFinite(day) || day < 1 || day > 28) return null;

  const y = fromDate.getFullYear();
  const m = fromDate.getMonth();
  let candidate = new Date(y, m, day, 12, 0, 0, 0);

  if (candidate.getTime() <= fromDate.getTime()) {
    candidate = new Date(y, m + 1, day, 12, 0, 0, 0);
  }

  return candidate;
}
