import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
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
import { computeScheduleDays } from "@/lib/schedule";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Period } from "./period-sidebar";

function defaultPeriod() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 16);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 15);
  const fmt = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };
  const lbl = (d: Date) =>
    d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  return { start_date: fmt(start), end_date: fmt(end), label: `${lbl(start)} - ${lbl(end)}` };
}

export function NewPeriodDialog({
  onCreated,
  triggerClassName,
}: {
  onCreated?: (p: Period) => void;
  triggerClassName?: string;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const def = useMemo(defaultPeriod, []);
  const [start, setStart] = useState(def.start_date);
  const [end, setEnd] = useState(def.end_date);
  const [label, setLabel] = useState(def.label);

  useEffect(() => {
    if (open) {
      setStart(def.start_date);
      setEnd(def.end_date);
      setLabel(def.label);
    }
  }, [open, def]);

  const create = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const userId = u.user!.id;
      const { data, error } = await supabase
        .from("periods")
        .insert({ user_id: userId, label, start_date: start, end_date: end })
        .select()
        .single();
      if (error) throw error;

      // Seed the schedule with S1 as a starting reference. The user can
      // flip any day manually and the rest of the period is re-inferred.
      const days = computeScheduleDays(start, end, "S1");
      if (days.length) {
        const { error: pdErr } = await supabase.from("period_days").insert(
          days.map((d) => ({
            user_id: userId,
            period_id: data.id,
            date: d.date,
            day_type: d.day_type,
          })),
        );
        if (pdErr) throw pdErr;
      }
      return data as Period;
    },
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ["periods"] });
      qc.invalidateQueries({ queryKey: ["period_employees"] });
      qc.invalidateQueries({ queryKey: ["period_days", p.id] });
      onCreated?.(p);
      setOpen(false);
      toast.success("Período criado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary" className={cn("w-full justify-start gap-2", triggerClassName)}>
          <Plus className="h-4 w-4" /> Novo período
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
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
              <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Fim</Label>
              <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>

          <div className="rounded-md border bg-muted/30 p-3 text-[11px] text-muted-foreground">
            A escala é detectada automaticamente. Ao definir qualquer dia da
            tabela como <strong>Plantão</strong> ou <strong>Folga</strong>, o
            sistema preenche os demais dias seguindo a alternância entre Semana
            1 e Semana 2. Dias editados manualmente são preservados.
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            Criar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
