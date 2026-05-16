import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppSidebar } from "@/components/app-sidebar";
import { type Period } from "@/components/period-sidebar";
import { SheetTable } from "@/components/sheet-table";
import { EmployeeSearch, type SearchOption } from "@/components/employee-search";
import { sortEmployees } from "@/lib/sort-employees";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [period, setPeriod] = useState<Period | null>(null);
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

  const { data: searchOptions = [] } = useQuery({
    queryKey: ["search-pe", period?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("period_employees")
        .select("id,name,role,vacant,position")
        .eq("period_id", period!.id);
      if (error) throw error;
      const sorted = sortEmployees(data ?? []);
      return sorted.map<SearchOption>((e) => ({
        id: e.id,
        name: e.name,
        role: e.role,
        vacant: e.vacant,
      }));
    },
    enabled: !!period?.id,
  });

  const options = useMemo(() => searchOptions, [searchOptions]);

  if (!ready) {
    return (
      <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">
        Carregando…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar selectedPeriodId={period?.id ?? null} onSelectPeriod={setPeriod} />

      <main className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-10 bg-background/80 backdrop-blur border-b">
          <div className="px-6 py-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-lg font-semibold tracking-tight">
                {period?.label ?? "Selecione um período"}
              </h1>
              <p className="text-xs text-muted-foreground">
                Controle de ocorrências da equipe
              </p>
            </div>
            <EmployeeSearch value={search} onChange={setSearch} options={options} />
          </div>
        </header>

        <div className="p-6">
          {period ? (
            <SheetTable period={period} search={search} />
          ) : (
            <div className="rounded-lg border bg-card p-12 text-center text-sm text-muted-foreground">
              Crie um período no menu lateral para começar.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
