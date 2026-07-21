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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plane, Repeat, Stethoscope } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { VacationDialog } from "./vacation-dialog";
import { MedicalLeaveDialog } from "./medical-leave-dialog";
import { SwapDialog } from "./swap-dialog";
import type { Period } from "./period-sidebar";

type Role = { id: string; name: string };

export type EmployeeEditable = {
  id: string;
  source_employee_id: string | null;
  name: string;
  role: string | null;
  vacant: boolean;
};

export function EmployeeEditDialog({
  employee,
  periodId,
  open,
  onOpenChange,
}: {
  employee: EmployeeEditable | null;
  periodId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const qc = useQueryClient();
  const { data: roles = [] } = useQuery({
    queryKey: ["roles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("roles")
        .select("id,name,position")
        .order("position");
      if (error) throw error;
      return (data ?? []) as Role[];
    },
  });
  const [name, setName] = useState("");
  const [role, setRole] = useState<string>("");
  const [vacant, setVacant] = useState(false);

  useEffect(() => {
    if (employee) {
      setName(employee.name);
      setRole(employee.role ?? "");
      setVacant(employee.vacant);
    }
  }, [employee]);

  const save = useMutation({
    mutationFn: async () => {
      if (!employee) return;
      const { error } = await supabase
        .from("period_employees")
        .update({ name: name.trim(), role: role || null, vacant })
        .eq("id", employee.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["period_employees", periodId] });
      onOpenChange(false);
      toast.success("Colaborador atualizado neste período");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [vacOpen, setVacOpen] = useState(false);
  const [medOpen, setMedOpen] = useState(false);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar colaborador (somente neste período)</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Cargo</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um cargo" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={r.name}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label className="text-sm">Posto vago</Label>
                <p className="text-xs text-muted-foreground">
                  Mostra “VAGO” no lugar do nome. O cargo continua visível.
                </p>
              </div>
              <Switch checked={vacant} onCheckedChange={setVacant} />
            </div>

            {employee && (
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  className="justify-start gap-2"
                  onClick={() => setVacOpen(true)}
                >
                  <Plane className="h-4 w-4" /> Férias
                </Button>
                <Button
                  variant="outline"
                  className="justify-start gap-2"
                  onClick={() => setMedOpen(true)}
                >
                  <Stethoscope className="h-4 w-4" /> Atestado
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={() => save.mutate()} disabled={!name.trim() || save.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <VacationDialog
        open={vacOpen}
        onOpenChange={setVacOpen}
        periodEmployeeId={employee?.id ?? null}
        sourceEmployeeId={employee?.source_employee_id ?? null}
        employeeName={employee?.vacant ? "VAGO" : employee?.name ?? ""}
      />

      <MedicalLeaveDialog
        open={medOpen}
        onOpenChange={setMedOpen}
        periodEmployeeId={employee?.id ?? null}
        sourceEmployeeId={employee?.source_employee_id ?? null}
        employeeName={employee?.vacant ? "VAGO" : employee?.name ?? ""}
      />
    </>
  );
}
