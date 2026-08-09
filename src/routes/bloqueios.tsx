import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, CheckCircle2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
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
import { BlockDialog, type BlockEmployeeOption } from "@/components/block-dialog";
import {
  blockDays,
  fmtBR,
  isActive,
  type EmployeeBlock,
} from "@/lib/blocks";
import { todayISO } from "@/lib/date-utils";
import { addDaysISO } from "@/lib/blocks";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/bloqueios")({
  head: () => ({
    meta: [
      { title: "Bloqueios — Extra / Troca Casada | Controle de Folha" },
      {
        name: "description",
        content:
          "Controle os colaboradores bloqueados para Extra e Troca Casada: motivo, período, origem e situação.",
      },
      { property: "og:title", content: "Bloqueios — Extra / Troca Casada" },
      {
        property: "og:description",
        content:
          "Acompanhe bloqueios automáticos e manuais de Extra e Troca Casada por colaborador.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BlocksPage,
});

function BlocksPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const today = todayISO();

  const [ready, setReady] = useState(false);
  const [selPeriod, setSelPeriod] = useState<Period | null>(null);

  const [search, setSearch] = useState("");
  const [fStatus, setFStatus] = useState("todos");
  const [fReason, setFReason] = useState("todos");
  const [fOrigin, setFOrigin] = useState("todos");
  const [fFrom, setFFrom] = useState("");
  const [fTo, setFTo] = useState("");
  const [onlyActiveNow, setOnlyActiveNow] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EmployeeBlock | null>(null);

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

  const { data: blocks = [] } = useQuery({
    queryKey: ["employee-blocks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_blocks")
        .select(
          "id,period_employee_id,source_employee_id,employee_name,reason,start_date,end_date,note,origin,status,source_kind,source_id",
        )
        .order("start_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as EmployeeBlock[];
    },
    enabled: ready,
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["block-employees", selPeriod?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("period_employees")
        .select("id,source_employee_id,name,vacant")
        .eq("period_id", selPeriod!.id)
        .order("position");
      if (error) throw error;
      return (data ?? []) as BlockEmployeeOption[];
    },
    enabled: !!selPeriod?.id,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("employee_blocks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employee-blocks"] });
      toast.success("Bloqueio excluído");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const close = useMutation({
    mutationFn: async (b: EmployeeBlock) => {
      const { error } = await supabase
        .from("employee_blocks")
        .update({
          status: "encerrado",
          end_date: b.end_date > today ? today : b.end_date,
        })
        .eq("id", b.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employee-blocks"] });
      toast.success("Bloqueio encerrado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reasons = useMemo(
    () => [...new Set(blocks.map((b) => b.reason))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [blocks],
  );

  const stats = useMemo(() => {
    const active = blocks.filter((b) => isActive(b, today));
    const soonLimit = addDaysISO(today, 7);
    return {
      active: active.length,
      ending: active.filter((b) => b.end_date <= soonLimit).length,
      auto: blocks.filter((b) => b.origin === "auto").length,
      manual: blocks.filter((b) => b.origin === "manual").length,
    };
  }, [blocks, today]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return blocks.filter((b) => {
      if (q && !b.employee_name.toLowerCase().includes(q)) return false;
      if (onlyActiveNow && !isActive(b, today)) return false;
      if (fStatus !== "todos") {
        const eff = isActive(b, today) ? "ativo" : "encerrado";
        if (eff !== fStatus) return false;
      }
      if (fReason !== "todos" && b.reason !== fReason) return false;
      if (fOrigin !== "todos" && b.origin !== fOrigin) return false;
      if (fFrom && b.end_date < fFrom) return false;
      if (fTo && b.start_date > fTo) return false;
      return true;
    });
  }, [blocks, search, onlyActiveNow, fStatus, fReason, fOrigin, fFrom, fTo, today]);

  if (!ready) {
    return (
      <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">
        Carregando…
      </div>
    );
  }

  const cards = [
    { label: "Bloqueios ativos", value: stats.active },
    { label: "Encerrando em 7 dias", value: stats.ending },
    { label: "Automáticos", value: stats.auto },
    { label: "Manuais", value: stats.manual },
  ];

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
              <h1 className="text-lg font-semibold tracking-tight">
                Bloqueios — Extra / Troca Casada
              </h1>
              <p className="text-xs text-muted-foreground">
                Colaboradores impedidos de realizar extras ou trocas casadas
              </p>
            </div>
            <Button
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Novo bloqueio
            </Button>
          </div>
        </header>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {cards.map((c) => (
              <div key={c.label} className="rounded-lg border bg-card p-3">
                <span className="text-xs font-semibold text-muted-foreground">{c.label}</span>
                <div className="mt-2 text-2xl font-bold">{c.value}</div>
              </div>
            ))}
          </div>

          <div className="rounded-lg border bg-card p-3 flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Pesquisar colaborador…"
                className="pl-8"
              />
            </div>
            <Select value={fStatus} onValueChange={setFStatus}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos status</SelectItem>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="encerrado">Encerrado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={fReason} onValueChange={setFReason}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Motivo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos motivos</SelectItem>
                {reasons.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={fOrigin} onValueChange={setFOrigin}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Origem" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas origens</SelectItem>
                <SelectItem value="auto">Automático</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={fFrom}
              onChange={(e) => setFFrom(e.target.value)}
              className="w-40"
              aria-label="De"
            />
            <Input
              type="date"
              value={fTo}
              onChange={(e) => setFTo(e.target.value)}
              className="w-40"
              aria-label="Até"
            />
            <Button
              variant={onlyActiveNow ? "default" : "outline"}
              size="sm"
              onClick={() => setOnlyActiveNow((v) => !v)}
            >
              Somente ativos agora
            </Button>
          </div>

          <div className="rounded-lg border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="text-left font-medium px-3 py-2">Colaborador</th>
                    <th className="text-left font-medium px-3 py-2">Motivo</th>
                    <th className="text-left font-medium px-3 py-2">Início</th>
                    <th className="text-left font-medium px-3 py-2">Término</th>
                    <th className="text-left font-medium px-3 py-2">Dias</th>
                    <th className="text-left font-medium px-3 py-2">Origem</th>
                    <th className="text-left font-medium px-3 py-2">Status</th>
                    <th className="text-right font-medium px-3 py-2">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-3 py-12 text-center text-sm text-muted-foreground"
                      >
                        Nenhum bloqueio encontrado.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((b) => {
                      const active = isActive(b, today);
                      return (
                        <tr
                          key={b.id}
                          className={cn(active && "bg-destructive/5")}
                        >
                          <td className="px-3 py-2 font-medium">{b.employee_name}</td>
                          <td className="px-3 py-2">
                            {b.reason}
                            {b.note && (
                              <div className="text-xs text-muted-foreground italic">
                                {b.note}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2">{fmtBR(b.start_date)}</td>
                          <td className="px-3 py-2">{fmtBR(b.end_date)}</td>
                          <td className="px-3 py-2">{blockDays(b)}</td>
                          <td className="px-3 py-2">
                            <span
                              className={cn(
                                "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold",
                                b.origin === "auto"
                                  ? "bg-primary/10 text-primary"
                                  : "bg-muted text-muted-foreground",
                              )}
                            >
                              {b.origin === "auto" ? "AUTOMÁTICO" : "MANUAL"}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold",
                                active
                                  ? "bg-destructive/10 text-destructive"
                                  : "bg-muted text-muted-foreground",
                              )}
                            >
                              {active ? (
                                <Ban className="h-3 w-3" />
                              ) : (
                                <CheckCircle2 className="h-3 w-3" />
                              )}
                              {active ? "ATIVO" : "ENCERRADO"}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => {
                                  setEditing(b);
                                  setDialogOpen(true);
                                }}
                                className="text-muted-foreground hover:text-foreground p-1"
                                aria-label="Editar"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              {active && (
                                <button
                                  onClick={() => close.mutate(b)}
                                  className="text-muted-foreground hover:text-foreground p-1"
                                  aria-label="Encerrar bloqueio"
                                  title="Encerrar bloqueio"
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                              <button
                                onClick={() => remove.mutate(b.id)}
                                className="text-muted-foreground hover:text-destructive p-1"
                                aria-label="Excluir"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      <BlockDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        employees={employees}
        editing={editing}
      />
    </div>
  );
}
