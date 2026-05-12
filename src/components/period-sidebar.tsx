import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, Plus, Trash2, LogOut, ClipboardList } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";

export type Period = {
  id: string;
  label: string;
  start_date: string;
  end_date: string;
};

function defaultPeriod() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 16);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 15);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const lbl = (d: Date) =>
    d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  return { start_date: fmt(start), end_date: fmt(end), label: `${lbl(start)} - ${lbl(end)}` };
}

export function PeriodSidebar({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (p: Period) => void;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState(defaultPeriod().start_date);
  const [end, setEnd] = useState(defaultPeriod().end_date);
  const [label, setLabel] = useState(defaultPeriod().label);

  const { data: periods = [] } = useQuery({
    queryKey: ["periods"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("periods")
        .select("id,label,start_date,end_date")
        .order("start_date", { ascending: false });
      if (error) throw error;
      // auto-select first if none selected
      if (data && data.length && !selectedId) onSelect(data[0]);
      return data ?? [];
    },
  });

  const createPeriod = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("periods")
        .insert({ user_id: u.user!.id, label, start_date: start, end_date: end })
        .select()
        .single();
      if (error) throw error;
      return data as Period;
    },
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ["periods"] });
      onSelect(p);
      setOpen(false);
      toast.success("Período criado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removePeriod = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("periods").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["periods"] });
      toast.success("Período removido");
    },
  });

  return (
    <aside className="w-64 shrink-0 bg-sidebar text-sidebar-foreground flex flex-col h-screen sticky top-0">
      <div className="p-4 border-b border-sidebar-border flex items-center gap-2">
        <div className="grid place-items-center w-8 h-8 rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
          <ClipboardList className="h-4 w-4" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold">Controle de Folha</p>
          <p className="text-[11px] text-sidebar-foreground/60">Períodos</p>
        </div>
      </div>

      <div className="p-3">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="w-full justify-start gap-2" variant="secondary">
              <Plus className="h-4 w-4" /> Novo período
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar período</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Rótulo</Label>
                <Input value={label} onChange={(e) => setLabel(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Início</Label>
                  <Input
                    type="date"
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Fim</Label>
                  <Input
                    type="date"
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => createPeriod.mutate()} disabled={createPeriod.isPending}>
                Criar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-3 space-y-1 sheet-scroll">
        {periods.map((p) => (
          <div
            key={p.id}
            className={cn(
              "group flex items-center gap-2 rounded-md px-2 py-2 cursor-pointer text-sm",
              selectedId === p.id
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "hover:bg-sidebar-accent/60",
            )}
            onClick={() => onSelect(p)}
          >
            <Calendar className="h-4 w-4 opacity-70" />
            <span className="flex-1 truncate">{p.label}</span>
            <button
              className="opacity-0 group-hover:opacity-60 hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                if (confirm("Remover este período e todas as ocorrências dele?"))
                  removePeriod.mutate(p.id);
              }}
              aria-label="Remover período"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {periods.length === 0 && (
          <p className="text-xs text-sidebar-foreground/60 px-2 py-4">
            Nenhum período ainda. Crie o primeiro.
          </p>
        )}
      </nav>

      <div className="p-3 border-t border-sidebar-border">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-sidebar-foreground hover:bg-sidebar-accent"
          onClick={async () => {
            await supabase.auth.signOut();
            navigate({ to: "/auth" });
          }}
        >
          <LogOut className="h-4 w-4" /> Sair
        </Button>
      </div>
    </aside>
  );
}
