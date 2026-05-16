// Weekly schedule (S1 / S2) used to auto-populate Plantão / Folga days
// when a new period is created.

export type WeekScale = "S1" | "S2";
export type SlotType = "plantao" | "folga";

// Monday-first index: 0=Mon, 1=Tue, ..., 6=Sun
export const WEEKDAY_NAMES = [
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
  "Domingo",
] as const;
export const WEEKDAY_SHORT = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"] as const;

// Index by Monday-first weekday position.
export const SCALES: Record<WeekScale, SlotType[]> = {
  // Seg P, Ter F, Qua P, Qui F, Sex F, Sáb P, Dom P
  S1: ["plantao", "folga", "plantao", "folga", "folga", "plantao", "plantao"],
  // Seg F, Ter P, Qua F, Qui P, Sex P, Sáb F, Dom F
  S2: ["folga", "plantao", "folga", "plantao", "plantao", "folga", "folga"],
};

// JS getDay(): 0=Sun..6=Sat. Convert to Mon=0..Sun=6.
function mondayIdx(jsDay: number): number {
  return (jsDay + 6) % 7;
}

/**
 * Compute the day_type for every date in [start..end].
 *
 * The schedule alternates between S1 and S2 each calendar week (Mon→Sun).
 * The first week of the period uses `startingWeek`.
 */
export function computeScheduleDays(
  start: string,
  end: string,
  startingWeek: WeekScale,
): { date: string; day_type: SlotType }[] {
  const out: { date: string; day_type: SlotType }[] = [];
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");

  // Find the Monday on or before the start date — this is the anchor for
  // alternating weeks.
  const anchor = new Date(s);
  anchor.setDate(anchor.getDate() - mondayIdx(anchor.getDay()));

  const MS_DAY = 86400000;
  const other: WeekScale = startingWeek === "S1" ? "S2" : "S1";

  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
    const weekIdx = Math.floor((d.getTime() - anchor.getTime()) / (7 * MS_DAY));
    const scale: WeekScale = weekIdx % 2 === 0 ? startingWeek : other;
    const wd = mondayIdx(d.getDay());
    const day_type = SCALES[scale][wd];
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    out.push({ date: `${y}-${m}-${day}`, day_type });
  }
  return out;
}
