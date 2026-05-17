import { useEffect, useState } from "react";
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

export function VacationDialog({
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
    queryKey: ["vacations", periodEmployeeId, sourceEmployeeId],
    queryFn: async () => {
      // Show vacations linked to this period-employee OR to its source
      // employee (so vacations show up across all periods of the same person).
      let q = supabase
        .from("employee_vacations")
        .select("id,start_date,end_date");
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
  const [end, setEnd] = useState("");

  useEffect(() => {
    if (open) {
      setStart("");
      setEnd("");
    }
  }, [open]);

  const add = useMutation({
    mutationFn: async () => {
      if (!periodEmployeeId) return;
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("employee_vacations").insert({
        user_id: u.user!.id,
        period_employee_id: periodEmployeeId,
        source_employee_id: sourceEmployeeId,
        start_date: start,
        end_date: end,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vacations"] });
      qc.invalidateQueries({ queryKey: ["vacations-by-period"] });
      setStart("");
      setEnd("");
      toast.success("Férias registradas");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("employee_vacations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vacations"] });
      qc.invalidateQueries({ queryKey: ["vacations-by-period"] });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Férias — {employeeName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Início</Label>
              <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Fim</Label>
              <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
          <Button
            onClick={() => add.mutate()}
            disabled={!start || !end || start > end || add.isPending}
            className="w-full"
          >
            Adicionar período de férias
          </Button>

          {existing.length > 0 && (
            <div className="border-t pt-3 space-y-1.5">
              <Label className="text-xs text-muted-foreground">Períodos registrados</Label>
              {existing.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between rounded-md border bg-card px-3 py-2 text-sm"
                >
                  <span>
                    {new Date(v.start_date + "T00:00:00").toLocaleDateString("pt-BR")} →{" "}
                    {new Date(v.end_date + "T00:00:00").toLocaleDateString("pt-BR")}
                  </span>
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
