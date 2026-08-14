import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { Search, X, ShieldAlert, ShieldCheck } from "lucide-react";

import { cn } from "@/lib/utils";
import { isInjustificada, type OccType } from "@/lib/occurrence";
import { isActive, fmtBR, type EmployeeBlock } from "@/lib/blocks";

type PE = {
  id: string;
  source_employee_id: string | null;
  name: string;
  role: string | null;
  vacant: boolean;
};

type Occ = { employee_id: string; date: string; type: OccType; reason: string | null };
type Ranged = {
  period_employee_id: string | null;
  source_employee_id: string | null;
  start_date: string;
  end_date: string;
};
type Swap = {
  period_employee_id: string;
  source_employee_id: string | null;
  work_date: string;
  off_date: string;
  canceled: boolean;
};

function overlaps(a1: string, a2: string, b1: string, b2: string) {
  return a1 <= b2 && b1 <= a2;
}

export function SummaryTable({
  employees,
  occurrences,
  medicalLeaves,
  swaps,
  blocks,
  periodStart,
  periodEnd,
  search,
  onSearchChange,
}: {
  employees: PE[];
  occurrences: Occ[];
  medicalLeaves: Ranged[];
  swaps: Swap[];
  blocks: EmployeeBlock[];
  periodStart: string;
  periodEnd: string;
  search: string;
  onSearchChange: (v: string) => void;
}) {
  const rows = useMemo(() => {
    const belongs = (e: PE, r: { period_employee_id: string | null; source_employee_id: string | null }) =>
      r.period_employee_id === e.id ||
      (!!r.source_employee_id && r.source_employee_id === e.source_employee_id);

    return employees.map((e) => {
      const occ = occurrences.filter(
        (o) => o.employee_id === e.id && o.date >= periodStart && o.date <= periodEnd,
      );
      const atrasos = occ.filter((o) => o.type === "A").length;
      const faltasInj = occ.filter((o) => isInjustificada(o)).length;
      const extras = occ.filter((o) => o.type === "EX").length;
      const atestados = medicalLeaves.filter(
        (m) => belongs(e, m) && overlaps(m.start_date, m.end_date, periodStart, periodEnd),
      ).length;
      const trocas = swaps.filter(
        (s) =>
          !s.canceled &&
          belongs(e, s) &&
          (overlaps(s.work_date, s.work_date, periodStart, periodEnd) ||
            overlaps(s.off_date, s.off_date, periodStart, periodEnd)),
      ).length;
      const block = blocks.find((b) => belongs(e, b) && isActive(b));
      return { emp: e, atrasos, faltasInj, extras, atestados, trocas, block };
    });
  }, [employees, occurrences, medicalLeaves, swaps, blocks, periodStart, periodEnd]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, r) => ({
          atrasos: acc.atrasos + r.atrasos,
          faltasInj: acc.faltasInj + r.faltasInj,
          extras: acc.extras + r.extras,
          atestados: acc.atestados + r.atestados,
          trocas: acc.trocas + r.trocas,
          bloqueados: acc.bloqueados + (r.block ? 1 : 0),
        }),
        { atrasos: 0, faltasInj: 0, extras: 0, atestados: 0, trocas: 0, bloqueados: 0 },
      ),
    [rows],
  );

  const num = (v: number, tone: string) => (
    <span className={cn("font-semibold tabular-nums", v === 0 ? "text-muted-foreground/40" : tone)}>
      {v}
    </span>
  );

  return (
    <div className="overflow-auto sheet-scroll max-h-[calc(100vh-12rem)]">
      <table className="border-separate border-spacing-0 text-sm w-full">
        <thead className="sticky top-0 z-20">
          <tr>
            <th className="sticky left-0 z-30 bg-card border-b border-r min-w-[240px] text-left px-3 py-2 font-medium text-muted-foreground align-top">
              <div className="space-y-1.5">
                <div>Colaborador</div>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => onSearchChange(e.target.value)}
                    placeholder="Pesquisar…"
                    className="w-full h-7 pl-7 pr-6 text-xs rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  {search && (
                    <button
                      onClick={() => onSearchChange("")}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label="Limpar"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            </th>
            {["Atrasos", "Faltas injust.", "Extras", "Atestados", "Trocas casadas"].map((h) => (
              <th
                key={h}
                className="bg-card border-b border-r px-3 py-2 font-medium text-muted-foreground text-center whitespace-nowrap"
              >
                {h}
              </th>
            ))}
            <th className="bg-card border-b px-3 py-2 font-medium text-muted-foreground text-center">
              Bloqueio
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ emp, atrasos, faltasInj, extras, atestados, trocas, block }) => (
            <tr key={emp.id} className="hover:bg-accent/20 transition-colors">
              <td className="sticky left-0 z-10 bg-card border-b border-r px-3 py-2">
                <div className={cn("font-medium", emp.vacant && "text-muted-foreground italic")}>
                  {emp.vacant ? "VAGO" : emp.name}
                </div>
                <div className="text-xs text-muted-foreground">{emp.role ?? "—"}</div>
              </td>
              <td className="border-b border-r px-3 py-2 text-center">{num(atrasos, "text-occ-a")}</td>
              <td className="border-b border-r px-3 py-2 text-center">{num(faltasInj, "text-occ-inj")}</td>
              <td className="border-b border-r px-3 py-2 text-center">{num(extras, "text-occ-ex")}</td>
              <td className="border-b border-r px-3 py-2 text-center">{num(atestados, "text-occ-ate")}</td>
              <td className="border-b border-r px-3 py-2 text-center">{num(trocas, "text-occ-tc")}</td>
              <td className="border-b px-3 py-2 text-center">
                {block ? (
                  <Link
                    to="/bloqueios"
                    className="inline-flex items-center gap-1 rounded-full bg-destructive/10 text-destructive px-2 py-0.5 text-xs font-medium hover:bg-destructive/20"
                    title={`${block.reason} · até ${fmtBR(block.end_date)}`}
                  >
                    <ShieldAlert className="h-3 w-3" />
                    Bloqueado até {fmtBR(block.end_date)}
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <ShieldCheck className="h-3 w-3" /> Livre
                  </span>
                )}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="text-center py-12 text-sm text-muted-foreground">
                Nenhum colaborador encontrado.
              </td>
            </tr>
          )}
          {rows.length > 0 && (
            <tr className="bg-muted/40 font-medium">
              <td className="sticky left-0 z-10 bg-muted/40 border-t border-r px-3 py-2">Total da equipe</td>
              <td className="border-t border-r px-3 py-2 text-center tabular-nums">{totals.atrasos}</td>
              <td className="border-t border-r px-3 py-2 text-center tabular-nums">{totals.faltasInj}</td>
              <td className="border-t border-r px-3 py-2 text-center tabular-nums">{totals.extras}</td>
              <td className="border-t border-r px-3 py-2 text-center tabular-nums">{totals.atestados}</td>
              <td className="border-t border-r px-3 py-2 text-center tabular-nums">{totals.trocas}</td>
              <td className="border-t px-3 py-2 text-center text-xs text-muted-foreground">
                {totals.bloqueados} bloqueado{totals.bloqueados === 1 ? "" : "s"}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
