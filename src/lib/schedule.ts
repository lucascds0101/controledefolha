// Weekly schedule (S1 / S2) used to auto-populate Plantão / Folga days.

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

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Compute the day_type for every date in [start..end] given a starting
 * scale for the first week (Mon→Sun) of the period.
 */
export function computeScheduleDays(
  start: string,
  end: string,
  startingWeek: WeekScale,
): { date: string; day_type: SlotType }[] {
  const out: { date: string; day_type: SlotType }[] = [];
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");

  const anchor = new Date(s);
  anchor.setDate(anchor.getDate() - mondayIdx(anchor.getDay()));

  const MS_DAY = 86400000;
  const other: WeekScale = startingWeek === "S1" ? "S2" : "S1";

  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
    const weekIdx = Math.floor((d.getTime() - anchor.getTime()) / (7 * MS_DAY));
    const scale: WeekScale = weekIdx % 2 === 0 ? startingWeek : other;
    const wd = mondayIdx(d.getDay());
    out.push({ date: toISO(d), day_type: SCALES[scale][wd] });
  }
  return out;
}

/**
 * Given a manually-anchored day (date + type the user set), figure out
 * which scale (S1 or S2) the WEEK containing that date is on.
 * If the anchor matches both scales for that weekday, returns null.
 */
export function inferScaleForAnchor(
  anchorDate: string,
  anchorType: SlotType,
): WeekScale | null {
  const d = new Date(anchorDate + "T00:00:00");
  const wd = mondayIdx(d.getDay());
  const s1 = SCALES.S1[wd];
  const s2 = SCALES.S2[wd];
  if (s1 === anchorType && s2 !== anchorType) return "S1";
  if (s2 === anchorType && s1 !== anchorType) return "S2";
  return null;
}

/**
 * Determine the scale (S1/S2) for any arbitrary date, given that
 * `anchorDate` is known to be on `anchorScale`.
 */
export function scaleForDate(
  date: string,
  anchorDate: string,
  anchorScale: WeekScale,
): WeekScale {
  const MS_DAY = 86400000;
  const d = new Date(date + "T00:00:00");
  const a = new Date(anchorDate + "T00:00:00");
  // Use Monday of each week as the comparison key so days within the
  // same Mon-Sun week always resolve to the same scale.
  const dMon = new Date(d);
  dMon.setDate(dMon.getDate() - mondayIdx(dMon.getDay()));
  const aMon = new Date(a);
  aMon.setDate(aMon.getDate() - mondayIdx(aMon.getDay()));
  const weeksDiff = Math.round((dMon.getTime() - aMon.getTime()) / (7 * MS_DAY));
  const flip = ((weeksDiff % 2) + 2) % 2 === 1;
  const other: WeekScale = anchorScale === "S1" ? "S2" : "S1";
  return flip ? other : anchorScale;
}

/**
 * Given a single manual anchor (date + chosen P/F), expand the schedule
 * across the whole [start..end] range, returning a {date -> day_type} map.
 * Returns null if the anchor type is ambiguous for that weekday (P/F same
 * in both scales — impossible with current SCALES but kept as a safety).
 */
export function expandScheduleFromAnchor(
  start: string,
  end: string,
  anchorDate: string,
  anchorType: SlotType,
): Map<string, SlotType> | null {
  const scale = inferScaleForAnchor(anchorDate, anchorType);
  if (!scale) return null;
  const map = new Map<string, SlotType>();
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
    const iso = toISO(d);
    const s12 = scaleForDate(iso, anchorDate, scale);
    const wd = mondayIdx(d.getDay());
    map.set(iso, SCALES[s12][wd]);
  }
  return map;
}

/**
 * Helper: get the Monday-anchored ISO week key for a date (yyyy-mm-dd of Monday).
 */
export function mondayKey(date: string): string {
  const d = new Date(date + "T00:00:00");
  d.setDate(d.getDate() - mondayIdx(d.getDay()));
  return toISO(d);
}
