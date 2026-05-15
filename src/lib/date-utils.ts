// Local-time today as ISO yyyy-mm-dd (avoids UTC drift).
export function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export type DayState = "past" | "today" | "future";
export function dayState(iso: string, today = todayISO()): DayState {
  if (iso === today) return "today";
  return iso < today ? "past" : "future";
}
