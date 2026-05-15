import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AppSidebar } from "@/components/app-sidebar";
import { type Period } from "@/components/period-sidebar";
import { OCC_META, OCC_TYPES, summaryFor, type OccType } from "@/lib/occurrence";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/analise")({
  component: AnalysisPage,
});

type PE = { id: string; name: string; role: string | null; vacant: boolean };
type Occ = {
  id: string;
  employee_id: string;
  date: string;
  type: OccType;
  arrival_time: string | null;
  partner_name: string | null;
  reason: string | null;
  covered: boolean | null;
  covered_by: string | null;
  exit_time: string | null;
  return_time: string | null;
  note: string | null;
};

function AnalysisPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [selPeriod, setSelPeriod] = useState<Period | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!s) navigate({ to: "/auth" });
    });
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) navigate({ to: "/auth" });
      else setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const { data: periods = [] } = useQuery({
    queryKey: ["periods"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("periods")
        .select("id,label,start_date,end_date")
        .order("start_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Period[];
    },
    enabled: ready,
  });

  useEffect(() => {
    if (!selPeriod && periods.length) setSelPeriod(periods[0]);
  }, [periods, selPeriod]);

  const periodId = selPeriod?.id ?? null;

  const { data: emps = [] } = useQuery({
    queryKey: ["analysis-pe", periodId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("period_employees")
        .select("id,name,role,vacant")
        .eq("period_id", periodId!)
        .order("position");
      if (error) throw error;
      return (data ?? []) as PE[];
    },
    enabled: !!periodId,
  });

  const { data: occs = [] } = useQuery({
    queryKey: ["analysis-occ", periodId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("occurrences")
        .select(
          "id,employee_id,date,type,arrival_time,partner_name,reason,covered,covered_by,exit_time,return_time,note",
        )
        .eq("period_id", periodId!)
        .order("date");
      if (error) throw error;
      return (data ?? []) as Occ[];
    },
    enabled: !!periodId,
  });

  const empMap = useMemo(() => new Map(emps.map((e) => [e.id, e])), [emps]);

  const totals = useMemo(() => {
    const t: Record<OccType, number> = { A: 0, TC: 0, F: 0, SA: 0 };
    for (const o of occs) if (o.type in t) t[o.type]++;
    return t;
  }, [occs]);

  const grouped = useMemo(() => {
    const g = new Map<string, Occ[]>();
    for (const o of occs) {
      const e = empMap.get(o.employee_id);
      const display = e?.vacant ? "VAGO" : e?.name ?? "—";
      if (search.trim() && !display.toLowerCase().includes(search.toLowerCase())) continue;
      const list = g.get(o.employee_id) ?? [];
      list.push(o);
      g.set(o.employee_id, list);
    }
    return [...g.entries()];
  }, [occs, empMap, search]);

  if (!ready) {
    return (
      <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">
        Carregando…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar
        selectedPeriodId={selPeriod?.id ?? null}
        onSelectPeriod={(p) => setSelPeriod(p)}
      />

      <main className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-10 bg-background/80 backdrop-blur border-b">
          <div className="px-6 py-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-lg font-semibold tracking-tight">Análise de ocorrências</h1>
              <p className="text-xs text-muted-foreground">
                Visualize todas as ocorrências de um período
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={selPeriod?.id ?? ""}
                onValueChange={(v) => {
                  const p = periods.find((x) => x.id === v);
                  if (p) setSelPeriod(p);
                }}
              >
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Período" />
                </SelectTrigger>
                <SelectContent>
                  {periods.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Pesquisar colaborador…"
                  className="pl-8"
                />
              </div>
            </div>
          </div>
        </header>

        <div className="p-6 space-y-6">
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

          <div className="space-y-4">
            {grouped.length === 0 ? (
              <div className="rounded-lg border bg-card p-12 text-center text-sm text-muted-foreground">
                Nenhuma ocorrência registrada{search ? " para esse colaborador" : ""}.
              </div>
            ) : (
              grouped.map(([empId, list]) => {
                const e = empMap.get(empId);
                const display = e?.vacant ? "VAGO" : e?.name ?? "—";
                return (
                  <div key={empId} className="rounded-lg border bg-card overflow-hidden">
                    <div className="p-3 border-b bg-muted/40 flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">{display}</h3>
                        {e?.role && !e.vacant && (
                          <p className="text-xs text-muted-foreground">{e.role}</p>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {list.length} ocorrência{list.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    <ul className="divide-y">
                      {list.map((o) => {
                        const m = OCC_META[o.type];
                        const date = new Date(o.date + "T00:00:00").toLocaleDateString(
                          "pt-BR",
                          { day: "2-digit", month: "2-digit", weekday: "short" },
                        );
                        return (
                          <li key={o.id} className="p-3 flex items-start gap-3 text-sm">
                            <span
                              className={cn(
                                "inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0",
                                m.bg,
                                m.text,
                              )}
                            >
                              {m.label}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-baseline gap-2 flex-wrap">
                                <span className="font-medium">{m.full}</span>
                                <span className="text-xs text-muted-foreground">{date}</span>
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {summaryFor(o)}
                              </div>
                              {o.note && (
                                <div className="text-xs italic text-muted-foreground mt-1">
                                  “{o.note}”
                                </div>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
