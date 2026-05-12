import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { OCC_META, OCC_TYPES, type OccType } from "@/lib/occurrence";
import { cn } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { Period } from "./period-sidebar";

export function Dashboard({ period }: { period: Period }) {
  const { data = [] } = useQuery({
    queryKey: ["dashboard", period.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("occurrences")
        .select("type,employee_id,quantity,employees(name)")
        .eq("period_id", period.id);
      if (error) throw error;
      return data as unknown as {
        type: OccType;
        employee_id: string;
        quantity: number | null;
        employees: { name: string } | null;
      }[];
    },
  });

  const totals = useMemo(() => {
    const t: Record<OccType, number> = { A: 0, HE: 0, F: 0, AT: 0, SA: 0, FO: 0 };
    for (const r of data) t[r.type]++;
    return t;
  }, [data]);

  const perEmp = useMemo(() => {
    const m = new Map<string, { name: string } & Record<OccType, number>>();
    for (const r of data) {
      const name = r.employees?.name ?? "—";
      const cur =
        m.get(r.employee_id) ??
        ({ name, A: 0, HE: 0, F: 0, AT: 0, SA: 0, FO: 0 } as ReturnType<
          typeof m.get
        > & object);
      (cur as Record<OccType, number>)[r.type]++;
      m.set(r.employee_id, cur as never);
    }
    return [...m.values()];
  }, [data]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {OCC_TYPES.map((t) => {
          const m = OCC_META[t];
          return (
            <div
              key={t}
              className={cn("rounded-lg border p-3", m.bg)}
            >
              <div className="flex items-center justify-between">
                <span className={cn("text-xs font-semibold", m.text)}>{m.full}</span>
                <span
                  className={cn(
                    "text-[10px] font-bold px-1.5 py-0.5 rounded bg-card/70",
                    m.text,
                  )}
                >
                  {m.label}
                </span>
              </div>
              <div className={cn("mt-2 text-2xl font-bold", m.text)}>{totals[t]}</div>
            </div>
          );
        })}
      </div>

      {perEmp.length > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <h3 className="font-semibold mb-3 text-sm">Resumo por colaborador</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={perEmp}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="A" stackId="a" fill="var(--occ-a)" name="Atrasos" />
                <Bar dataKey="F" stackId="a" fill="var(--occ-f)" name="Faltas" />
                <Bar dataKey="AT" stackId="a" fill="var(--occ-at)" name="Atestados" />
                <Bar dataKey="HE" stackId="a" fill="var(--occ-he)" name="H. Extra" />
                <Bar dataKey="SA" stackId="a" fill="var(--occ-sa)" name="Saída Ant." />
                <Bar dataKey="FO" stackId="a" fill="var(--occ-fo)" name="Folgas" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
