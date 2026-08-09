import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  BLOCK_REASONS,
  addDaysISO,
  BLOCK_DAYS,
  type EmployeeBlock,
} from "@/lib/blocks";
import { todayISO } from "@/lib/date-utils";

export type BlockEmployeeOption = {
  id: string;
  source_employee_id: string | null;
  name: string;
  vacant: boolean;
};

export function BlockDialog({
  open,
  onOpenChange,
  employees,
  editing,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  employees: BlockEmployeeOption[];
  editing: EmployeeBlock | null;
}) {
  const qc = useQueryClient();
  const [empId, setEmpId] = useState<string>("");
  const [reason, setReason] = useState<string>(BLOCK_REASONS[0]);
  const [start, setStart] = useState(todayISO());
  const [end, setEnd] = useState(addDaysISO(todayISO(), BLOCK_DAYS));
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"ativo" | "encerrado">("ativo");

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setEmpId(editing.period_employee_id ?? "");
      setReason(editing.reason);
      setStart(editing.start_date);
      setEnd(editing.end_date);
      setNote(editing.note ?? "");
      setStatus(editing.status);
    } else {
      setEmpId("");
      setReason(BLOCK_REASONS[0]);
      setStart(todayISO());
      setEnd(addDaysISO(todayISO(), BLOCK_DAYS));
      setNote("");
      setStatus("ativo");
    }
  }, [open, editing]);

  const save = useMutation({
    mutationFn: async () => {
      if (end < start) throw new Error("A data de término não pode ser anterior ao início.");
      if (editing) {
        const { error } = await supabase
          .from("employee_blocks")
          .update({
            reason,
            start_date: start,
            end_date: end,
            note: note.trim() || null,
            status,
          })
          .eq("id", editing.id);
        if (error) throw error;
        return;
      }
      const emp = employees.find((e) => e.id === empId);
      if (!emp) throw new Error("Selecione um colaborador.");
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("employee_blocks").insert({
        user_id: u.user!.id,
        period_employee_id: emp.id,
        source_employee_id: emp.source_employee_id,
        employee_name: emp.vacant ? "VAGO" : emp.name,
        reason,
        start_date: start,
        end_date: end,
        note: note.trim() || null,
        origin: "manual",
        status,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employee-blocks"] });
      toast.success(editing ? "Bloqueio atualizado" : "Bloqueio cadastrado");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar bloqueio" : "Novo bloqueio"}</DialogTitle>
          <DialogDescription>
            {editing
              ? `${editing.employee_name} — origem ${editing.origin === "auto" ? "automática" : "manual"}`
              : "Impedimento para Extra / Troca casada"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {!editing && (
            <div className="space-y-1.5">
              <Label className="text-xs">Colaborador</Label>
              <Select value={empId} onValueChange={setEmpId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione…" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.vacant ? "VAGO" : e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Motivo</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BLOCK_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Início</Label>
              <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Término</Label>
              <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Situação</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as "ativo" | "encerrado")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="encerrado">Encerrado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Observação</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Opcional"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending || (!editing && !empId)}
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
