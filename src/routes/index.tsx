import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { PeriodSidebar, type Period } from "@/components/period-sidebar";
import { SheetTable } from "@/components/sheet-table";
import { Dashboard } from "@/components/dashboard";

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

  if (!ready) {
    return (
      <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">
        Carregando…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <PeriodSidebar selectedId={period?.id ?? null} onSelect={setPeriod} />

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
        </header>

        <div className="p-6 space-y-6">
          {period ? (
            <>
              <Dashboard period={period} />
              <SheetTable period={period} search={search} />
            </>
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
