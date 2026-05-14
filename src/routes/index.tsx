import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Search, Briefcase } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PeriodSidebar, type Period } from "@/components/period-sidebar";
import { SheetTable } from "@/components/sheet-table";
import { Dashboard } from "@/components/dashboard";
import { ThemeToggle } from "@/components/theme-toggle";
import { RolesManager, useRoles } from "@/components/roles-manager";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [period, setPeriod] = useState<Period | null>(null);
  const [search, setSearch] = useState("");
  const { data: roles = [] } = useRoles();

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

  // Seed default roles for legacy accounts that signed up before roles existed.
  useEffect(() => {
    if (!ready) return;
    if (roles.length > 0) return;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const defaults = [
        "Supervisão",
        "Coordenação",
        "Backoffice",
        "PA",
        "Operador de monitoramento",
        "Operador de comunicação",
      ];
      await supabase.from("roles").insert(
        defaults.map((name, i) => ({ user_id: u.user!.id, name, position: i })),
      );
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, roles.length]);

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
            <div className="flex items-center gap-2">
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Pesquisar colaborador…"
                  className="pl-8"
                />
              </div>
              <RolesManager
                trigger={
                  <Button variant="outline" size="icon" aria-label="Cargos" title="Cargos">
                    <Briefcase className="h-4 w-4" />
                  </Button>
                }
              />
              <ThemeToggle />
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
