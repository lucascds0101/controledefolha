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

type Row = {
  type: OccType;
  employee_id: string;
  employees: { name: string } | null;
};

export function Dashboard({ period }: { period: Period }) {
  const { data = [] } = useQuery({
    queryKey: ["dashboard", period.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("occurrences")
        .select("type,employee_id,employees(name)")
        .eq("period_id", period.id);
      if (error) throw error;
      return data as unknown as Row[];
    },
  });

  const totals = useMemo(() => {
    const t: Record<OccType, number> = { A: 0, TC: 0, F: 0, SA: 0 };
    for (const r of data) if (r.type in t) t[r.type]++;
    return t;
  }, [data]);

  const perEmp = useMemo(() => {
    const m = new Map<string, { name: string } & Record<OccType, number>>();
    for (const r of data) {
      if (!OCC_TYPES.includes(r.type)) continue;
      const name = r.employees?.name ?? "—";
      const cur =
        m.get(r.employee_id) ?? ({ name, A: 0, TC: 0, F: 0, SA: 0 } as never);
      (cur as Record<OccType, number>)[r.type]++;
      m.set(r.employee_id, cur as never);
    }
    return [...m.values()];
  }, [data]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {OCC_TYPES.map((t) => {
          const m = OCC_META[t];
          return (
            <div key={t} className={cn("rounded-lg border p-3", m.bg)}>
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
                <Bar dataKey="TC" stackId="a" fill="var(--occ-tc)" name="Trocas" />
                <Bar dataKey="F" stackId="a" fill="var(--occ-f)" name="Faltas" />
                <Bar dataKey="SA" stackId="a" fill="var(--occ-sa)" name="Saída Ant." />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
