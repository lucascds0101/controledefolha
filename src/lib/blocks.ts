import { todayISO } from "./date-utils";

/** Default block duration (days added to the occurrence date). */
export const BLOCK_DAYS = 7;

export type BlockOrigin = "auto" | "manual";
export type BlockStatus = "ativo" | "encerrado";
export type BlockSourceKind = "falta" | "atestado";

export type EmployeeBlock = {
  id: string;
  period_employee_id: string | null;
  source_employee_id: string | null;
  employee_name: string;
  reason: string;
  start_date: string;
  end_date: string;
  note: string | null;
  origin: BlockOrigin;
  status: BlockStatus;
  source_kind: BlockSourceKind | null;
  source_id: string | null;
};

export const BLOCK_REASONS = [
  "Falta injustificada",
  "Atestado",
  "Advertência",
  "Suspensão",
  "Decisão da gestão",
  "Outro",
] as const;

export function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** End date for an automatic block created from an occurrence date. */
export function autoBlockEnd(startISO: string): string {
  return addDaysISO(startISO, BLOCK_DAYS);
}

export function blockDays(b: Pick<EmployeeBlock, "start_date" | "end_date">): number {
  const s = new Date(b.start_date + "T00:00:00").getTime();
  const e = new Date(b.end_date + "T00:00:00").getTime();
  return Math.max(1, Math.round((e - s) / 86400000) + 1);
}

/** A block is effectively active when not manually closed and today is inside the range. */
export function isActive(b: EmployeeBlock, today = todayISO()): boolean {
  if (b.status === "encerrado") return false;
  return b.start_date <= today && today <= b.end_date;
}

export function coversDate(b: EmployeeBlock, dateISO: string): boolean {
  if (b.status === "encerrado") return false;
  return b.start_date <= dateISO && dateISO <= b.end_date;
}

export function fmtBR(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR");
}
