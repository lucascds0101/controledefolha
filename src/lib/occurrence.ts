export type OccType = "A" | "HE" | "F" | "AT" | "SA" | "FO";

export const OCC_META: Record<
  OccType,
  { label: string; full: string; bg: string; text: string; ring: string }
> = {
  A: {
    label: "A",
    full: "Atraso",
    bg: "bg-occ-a-bg",
    text: "text-occ-a",
    ring: "ring-occ-a/40",
  },
  HE: {
    label: "HE",
    full: "Hora extra",
    bg: "bg-occ-he-bg",
    text: "text-occ-he",
    ring: "ring-occ-he/40",
  },
  F: {
    label: "F",
    full: "Falta",
    bg: "bg-occ-f-bg",
    text: "text-occ-f",
    ring: "ring-occ-f/40",
  },
  AT: {
    label: "AT",
    full: "Atestado",
    bg: "bg-occ-at-bg",
    text: "text-occ-at",
    ring: "ring-occ-at/40",
  },
  SA: {
    label: "SA",
    full: "Saída antecipada",
    bg: "bg-occ-sa-bg",
    text: "text-occ-sa",
    ring: "ring-occ-sa/40",
  },
  FO: {
    label: "FO",
    full: "Folga",
    bg: "bg-occ-fo-bg",
    text: "text-occ-fo",
    ring: "ring-occ-fo/40",
  },
};

export const OCC_TYPES: OccType[] = ["A", "HE", "F", "AT", "SA", "FO"];

export function eachDay(start: string, end: string): string[] {
  const out: string[] = [];
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export function fmtDay(iso: string): { day: string; weekday: string; isWeekend: boolean } {
  const d = new Date(iso + "T00:00:00");
  const wk = d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
  const wd = d.getDay();
  return { day: String(d.getDate()).padStart(2, "0"), weekday: wk, isWeekend: wd === 0 || wd === 6 };
}
