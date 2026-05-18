export type OccType = "A" | "TC" | "F" | "SA" | "SD" | "EX";

export const OCC_META: Record<
  OccType,
  { label: string; full: string; bg: string; text: string; ring: string }
> = {
  A: { label: "A", full: "Atraso", bg: "bg-occ-a-bg", text: "text-occ-a", ring: "ring-occ-a/40" },
  TC: { label: "TC", full: "Troca casada", bg: "bg-occ-tc-bg", text: "text-occ-tc", ring: "ring-occ-tc/40" },
  F: { label: "F", full: "Falta", bg: "bg-occ-f-bg", text: "text-occ-f", ring: "ring-occ-f/40" },
  SA: { label: "SA", full: "Saída antecipada", bg: "bg-occ-sa-bg", text: "text-occ-sa", ring: "ring-occ-sa/40" },
  SD: { label: "SD", full: "Sanção disciplinar", bg: "bg-occ-sd-bg", text: "text-occ-sd", ring: "ring-occ-sd/40" },
  EX: { label: "EX", full: "Extra", bg: "bg-occ-ex-bg", text: "text-occ-ex", ring: "ring-occ-ex/40" },
};

export const OCC_TYPES: OccType[] = ["A", "TC", "F", "SA", "SD", "EX"];

// Visual override for Atestado (a special kind of Falta)
export const ATESTADO_META = {
  label: "ATE",
  full: "Atestado",
  bg: "bg-occ-ate-bg",
  text: "text-occ-ate",
  ring: "ring-occ-ate/40",
};

export const FALTA_REASONS = [
  "Sem contato",
  "Injustificado",
  "Atestado",
  "Abono",
  "Hospital",
  "Prob. pessoal",
  "Licença",
  "Prob. VT",
  "Afastamento",
  "Desligamento",
  "Outros",
] as const;

export const SAIDA_REASONS = [
  "Abandono",
  "Emergência médica",
  "Problema pessoal",
] as const;

export const SANCTION_KINDS = [
  "Advertência verbal",
  "Advertência escrita",
  "Suspensão",
] as const;

export function isAtestado(o: { type: OccType; reason?: string | null }): boolean {
  return o.type === "F" && o.reason === "Atestado";
}

export function eachDay(start: string, end: string): string[] {
  const out: string[] = [];
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    out.push(`${y}-${m}-${day}`);
  }
  return out;
}

export function fmtDay(iso: string): { day: string; weekday: string; isWeekend: boolean } {
  const d = new Date(iso + "T00:00:00");
  const wk = d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
  const wd = d.getDay();
  return { day: String(d.getDate()).padStart(2, "0"), weekday: wk, isWeekend: wd === 0 || wd === 6 };
}

export function summaryFor(o: {
  type: OccType;
  arrival_time?: string | null;
  partner_name?: string | null;
  reason?: string | null;
  covered?: boolean | null;
  covered_by?: string | null;
  exit_time?: string | null;
  return_time?: string | null;
  note?: string | null;
  sanction_kind?: string | null;
  suspension_days?: number | null;
}): string {
  switch (o.type) {
    case "A":
      return o.arrival_time ? `Chegou ${o.arrival_time.slice(0, 5)}` : "Atraso";
    case "TC":
      return o.partner_name ? `Troca com ${o.partner_name}` : "Troca casada";
    case "F": {
      const parts: string[] = [];
      if (o.reason) parts.push(o.reason);
      if (o.covered) parts.push(`coberto por ${o.covered_by || "—"}`);
      else if (o.covered === false) parts.push("não coberto");
      return parts.join(" · ") || "Falta";
    }
    case "SA": {
      const parts: string[] = [];
      if (o.reason) parts.push(o.reason);
      if (o.exit_time) parts.push(`saída ${o.exit_time.slice(0, 5)}`);
      if (o.return_time) parts.push(`retorno ${o.return_time.slice(0, 5)}`);
      return parts.join(" · ") || "Saída antecipada";
    }
    case "SD": {
      const parts: string[] = [];
      if (o.sanction_kind) parts.push(o.sanction_kind);
      if (o.sanction_kind === "Suspensão" && o.suspension_days)
        parts.push(`${o.suspension_days} dia${o.suspension_days === 1 ? "" : "s"}`);
      return parts.join(" · ") || "Sanção disciplinar";
    }
    case "EX":
      return "Extra (folga trabalhada)";
  }
}
