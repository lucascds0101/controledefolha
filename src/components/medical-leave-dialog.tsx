import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function MedicalLeaveDialog({
  open,
  onOpenChange,
  periodEmployeeId,
  sourceEmployeeId,
  employeeName,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  periodEmployeeId: string | null;
  sourceEmployeeId: string | null;
  employeeName: string;
}) {
  const qc = useQueryClient();

  const { data: existing = [] } = useQuery({
    queryKey: ["medical-leaves", periodEmployeeId, sourceEmployeeId],
    queryFn: async () => {
      let q = supabase
        .from("employee_medical_leaves")
        .select("id,start_date,end_date,days,cid");
      if (sourceEmployeeId) {
        q = q.or(
          `source_employee_id.eq.${sourceEmployeeId},period_employee_id.eq.${periodEmployeeId}`,
        );
      } else {
        q = q.eq("period_employee_id", periodEmployeeId!);
      }
      const { data, error } = await q.order("start_date");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!periodEmployeeId && open,
  });

  const [start, setStart] = useState("");
  const [days, setDays] = useState<number>(1);
  const [cid, setCid] = useState("");

  useEffect(() => {
    if (open) {
      setStart("");
      setDays(1);
      setCid("");
    }
  }, [open]);

  const end = useMemo(
    () => (start && days >= 1 ? addDaysISO(start, days - 1) : ""),
    [start, days],
  );

  const add = useMutation({
    mutationFn: async () => {
      if (!periodEmployeeId) return;
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("employee_medical_leaves").insert({
        user_id: u.user!.id,
        period_employee_id: periodEmployeeId,
        source_employee_id: sourceEmployeeId,
        start_date: start,
        days,
        end_date: end,
        cid: cid.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["medical-leaves"] });
      qc.invalidateQueries({ queryKey: ["medical-leaves-by-period"] });
      setStart("");
      setDays(1);
      setCid("");
      toast.success("Atestado registrado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("employee_medical_leaves")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["medical-leaves"] });
      qc.invalidateQueries({ queryKey: ["medical-leaves-by-period"] });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Atestado — {employeeName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Início</Label>
              <Input
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Dias</Label>
              <Input
                type="number"
                min={1}
                value={days}
                onChange={(e) => setDays(Math.max(1, Number(e.target.value) || 1))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Fim</Label>
              <Input type="date" value={end} readOnly disabled />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">CID (opcional)</Label>
            <Input
              value={cid}
              onChange={(e) => setCid(e.target.value)}
              placeholder="Ex.: J06.9"
            />
          </div>
          <Button
            onClick={() => add.mutate()}
            disabled={!start || !days || add.isPending}
            className="w-full"
          >
            Adicionar atestado
          </Button>

          {existing.length > 0 && (
            <div className="border-t pt-3 space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Atestados registrados
              </Label>
              {existing.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between rounded-md border bg-card px-3 py-2 text-sm"
                >
                  <div className="flex flex-col">
                    <span>
                      {new Date(v.start_date + "T00:00:00").toLocaleDateString(
                        "pt-BR",
                      )}{" "}
                      →{" "}
                      {new Date(v.end_date + "T00:00:00").toLocaleDateString(
                        "pt-BR",
                      )}{" "}
                      <span className="text-muted-foreground">
                        ({v.days} {v.days === 1 ? "dia" : "dias"})
                      </span>
                    </span>
                    {v.cid && (
                      <span className="text-xs text-muted-foreground">
                        CID: {v.cid}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => remove.mutate(v.id)}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="Remover"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
