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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Check, Trash2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { todayISO } from "@/lib/date-utils";
import type { Period } from "./period-sidebar";

type Swap = {
  id: string;
  period_employee_id: string;
  source_employee_id: string | null;
  partner_period_employee_id: string | null;
  partner_source_employee_id: string | null;
  work_date: string;
  off_date: string;
  work_confirmed: boolean;
  work_confirmed_at: string | null;
  off_confirmed: boolean;
  off_confirmed_at: string | null;
  canceled: boolean;
  canceled_at: string | null;
  note: string | null;
};

type Partner = {
  id: string;
  name: string;
  role: string | null;
  vacant: boolean;
  source_employee_id: string | null;
};

type LegStatus = "Agendada" | "Pendente de confirmação" | "Confirmada" | "Cancelada";

function legStatus(
  date: string,
  confirmed: boolean,
  canceled: boolean,
  today: string,
): LegStatus {
  if (canceled) return "Cancelada";
  if (confirmed) return "Confirmada";
  return date > today ? "Agendada" : "Pendente de confirmação";
}

function statusClass(s: LegStatus): string {
  switch (s) {
    case "Confirmada":
      return "bg-occ-p-bg text-occ-p";
    case "Pendente de confirmação":
      return "bg-occ-a-bg text-occ-a";
    case "Cancelada":
      return "bg-muted text-muted-foreground line-through";
    default:
      return "bg-occ-tc-bg text-occ-tc";
  }
}

function fmtBR(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR");
}

export function SwapDialog({
  open,
  onOpenChange,
  period,
  periodEmployeeId,
  sourceEmployeeId,
  employeeName,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  period: Period;
  periodEmployeeId: string | null;
  sourceEmployeeId: string | null;
  employeeName: string;
}) {
  const qc = useQueryClient();
  const today = todayISO();

  const { data: swaps = [] } = useQuery({
    queryKey: ["swaps", period.id, periodEmployeeId, sourceEmployeeId],
    enabled: !!periodEmployeeId && open,
    queryFn: async () => {
      let q = supabase
        .from("employee_swaps")
        .select(
          "id,period_employee_id,source_employee_id,partner_period_employee_id,partner_source_employee_id,work_date,off_date,work_confirmed,work_confirmed_at,off_confirmed,off_confirmed_at,canceled,canceled_at,note",
        )
        .gte("work_date", period.start_date)
        .lte("work_date", period.end_date);
      if (sourceEmployeeId) {
        q = q.or(
          `source_employee_id.eq.${sourceEmployeeId},period_employee_id.eq.${periodEmployeeId}`,
        );
      } else {
        q = q.eq("period_employee_id", periodEmployeeId!);
      }
      const { data, error } = await q.order("work_date");
      if (error) throw error;
      return (data ?? []) as Swap[];
    },
  });

  const { data: partners = [] } = useQuery({
    queryKey: ["swap-partners", period.id, periodEmployeeId],
    enabled: !!periodEmployeeId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("period_employees")
        .select("id,name,role,vacant,source_employee_id")
        .eq("period_id", period.id)
        .order("name");
      if (error) throw error;
      return ((data ?? []) as Partner[]).filter(
        (p) => p.id !== periodEmployeeId && !p.vacant,
      );
    },
  });

  const [workDate, setWorkDate] = useState("");
  const [offDate, setOffDate] = useState("");
  const [partnerId, setPartnerId] = useState<string>("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) {
      setWorkDate("");
      setOffDate("");
      setPartnerId("");
      setNote("");
    }
  }, [open]);

  // Count active (non-canceled) dates already used by this employee in this period.
  const activeDateCount = useMemo(
    () => swaps.filter((s) => !s.canceled).reduce((n, s) => n + 2, 0),
    [swaps],
  );

  const remaining = Math.max(0, 2 - activeDateCount);
  const atLimit = remaining < 2; // needs at least 2 free slots to add a new swap (work + off)

  const summary = useMemo(() => {
    let total = swaps.length;
    let pending = 0;
    let confirmed = 0;
    let canceled = 0;
    for (const s of swaps) {
      if (s.canceled) {
        canceled++;
        continue;
      }
      const w = legStatus(s.work_date, s.work_confirmed, false, today);
      const o = legStatus(s.off_date, s.off_confirmed, false, today);
      if (w === "Confirmada" && o === "Confirmada") confirmed++;
      else if (w === "Pendente de confirmação" || o === "Pendente de confirmação")
        pending++;
    }
    return { total, pending, confirmed, canceled };
  }, [swaps, today]);

  function validate(): string | null {
    if (!workDate || !offDate) return "Informe as duas datas.";
    if (workDate === offDate)
      return "A data de trabalho e a data de folga não podem ser iguais.";
    const inRange = (d: string) =>
      d >= period.start_date && d <= period.end_date;
    if (!inRange(workDate) || !inRange(offDate))
      return "As datas precisam estar dentro do período da folha.";
    if (atLimit)
      return "Este colaborador já atingiu o limite de 2 trocas casadas neste período.";
    return null;
  }

  const add = useMutation({
    mutationFn: async () => {
      const err = validate();
      if (err) throw new Error(err);
      const { data: u } = await supabase.auth.getUser();
      const partner = partners.find((p) => p.id === partnerId) ?? null;
      if (!periodEmployeeId) throw new Error("Colaborador inválido.");
      const { error } = await supabase.from("employee_swaps").insert({
        user_id: u.user!.id,
        period_employee_id: periodEmployeeId,
        source_employee_id: sourceEmployeeId,
        partner_period_employee_id: partner?.id ?? null,
        partner_source_employee_id: partner?.source_employee_id ?? null,
        work_date: workDate,
        off_date: offDate,
        note: note.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["swaps"] });
      qc.invalidateQueries({ queryKey: ["swaps-by-period", period.id] });
      setWorkDate("");
      setOffDate("");
      setPartnerId("");
      setNote("");
      toast.success("Troca casada registrada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const confirmLeg = useMutation({
    mutationFn: async (args: { id: string; leg: "work" | "off" }) => {
      const payload =
        args.leg === "work"
          ? { work_confirmed: true, work_confirmed_at: new Date().toISOString() }
          : { off_confirmed: true, off_confirmed_at: new Date().toISOString() };
      const { error } = await supabase
        .from("employee_swaps")
        .update(payload)
        .eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["swaps"] });
      qc.invalidateQueries({ queryKey: ["swaps-by-period", period.id] });
      toast.success("Presença confirmada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("employee_swaps")
        .update({ canceled: true, canceled_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["swaps"] });
      qc.invalidateQueries({ queryKey: ["swaps-by-period", period.id] });
      toast.success("Troca cancelada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("employee_swaps").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["swaps"] });
      qc.invalidateQueries({ queryKey: ["swaps-by-period", period.id] });
    },
  });

  const validationMsg = workDate && offDate ? validate() : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Troca casada — {employeeName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 max-h-[70vh] overflow-y-auto sheet-scroll pr-1">
          {/* Mini dashboard */}
          <div className="grid grid-cols-4 gap-2">
            <SummaryCard label="Total" value={summary.total} />
            <SummaryCard label="Pendentes" value={summary.pending} tint="occ-a" />
            <SummaryCard label="Confirmadas" value={summary.confirmed} tint="occ-p" />
            <SummaryCard label="Canceladas" value={summary.canceled} />
          </div>

          {/* Form */}
          <div className="rounded-lg border p-3 space-y-3 bg-card">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Data de trabalho (pagando)</Label>
                <Input
                  type="date"
                  min={period.start_date}
                  max={period.end_date}
                  value={workDate}
                  onChange={(e) => setWorkDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Data de folga (recebendo)</Label>
                <Input
                  type="date"
                  min={period.start_date}
                  max={period.end_date}
                  value={offDate}
                  onChange={(e) => setOffDate(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Colaborador envolvido (opcional)</Label>
              <Select
                value={partnerId || "none"}
                onValueChange={(v) => setPartnerId(v === "none" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um colaborador" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Sem parceiro —</SelectItem>
                  {partners.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                      {p.role ? ` · ${p.role}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Observação (opcional)</Label>
              <Textarea
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Motivo, acordo entre as partes, etc."
              />
            </div>

            {validationMsg && (
              <p className="text-xs text-destructive">{validationMsg}</p>
            )}
            {!validationMsg && atLimit && (
              <p className="text-xs text-muted-foreground">
                Limite de 2 trocas por período atingido.
              </p>
            )}

            <Button
              onClick={() => add.mutate()}
              disabled={
                !workDate ||
                !offDate ||
                !!validationMsg ||
                atLimit ||
                add.isPending
              }
              className="w-full"
            >
              Adicionar troca
            </Button>
          </div>

          {/* List */}
          {swaps.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Trocas registradas neste período
              </Label>
              {swaps.map((s) => {
                const partner = partners.find(
                  (p) => p.id === s.partner_period_employee_id,
                );
                const wStatus = legStatus(
                  s.work_date,
                  s.work_confirmed,
                  s.canceled,
                  today,
                );
                const oStatus = legStatus(
                  s.off_date,
                  s.off_confirmed,
                  s.canceled,
                  today,
                );
                const canConfirmWork =
                  !s.canceled && !s.work_confirmed && s.work_date <= today;
                const canConfirmOff =
                  !s.canceled && !s.off_confirmed && s.off_date <= today;
                const bothFuture =
                  !s.canceled && s.work_date > today && s.off_date > today;
                return (
                  <div
                    key={s.id}
                    className={cn(
                      "rounded-md border bg-card p-3 space-y-2",
                      s.canceled && "opacity-60",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <div className="text-sm">
                          <span className="font-medium">
                            Trabalha {fmtBR(s.work_date)}
                          </span>{" "}
                          <span className="text-muted-foreground">→</span>{" "}
                          <span className="font-medium">
                            Folga {fmtBR(s.off_date)}
                          </span>
                        </div>
                        {partner && (
                          <div className="text-xs text-muted-foreground">
                            Com: {partner.name}
                          </div>
                        )}
                        {s.note && (
                          <div className="text-xs text-muted-foreground">
                            {s.note}
                          </div>
                        )}
                        <div className="flex flex-wrap gap-1 pt-1">
                          <span
                            className={cn(
                              "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold",
                              statusClass(wStatus),
                            )}
                          >
                            Trab: {wStatus}
                          </span>
                          <span
                            className={cn(
                              "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold",
                              statusClass(oStatus),
                            )}
                          >
                            Folga: {oStatus}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          if (confirm("Excluir esta troca?")) remove.mutate(s.id);
                        }}
                        className="text-muted-foreground hover:text-destructive"
                        aria-label="Excluir"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {!s.canceled && (canConfirmWork || canConfirmOff || bothFuture) && (
                      <div className="flex flex-wrap gap-2 pt-1 border-t">
                        {canConfirmWork && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 h-7"
                            onClick={() =>
                              confirmLeg.mutate({ id: s.id, leg: "work" })
                            }
                          >
                            <Check className="h-3.5 w-3.5" /> Confirmar trabalho
                          </Button>
                        )}
                        {canConfirmOff && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 h-7"
                            onClick={() =>
                              confirmLeg.mutate({ id: s.id, leg: "off" })
                            }
                          >
                            <Check className="h-3.5 w-3.5" /> Confirmar folga
                          </Button>
                        )}
                        {bothFuture && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="gap-1 h-7 text-destructive hover:text-destructive"
                            onClick={() => cancel.mutate(s.id)}
                          >
                            <XCircle className="h-3.5 w-3.5" /> Cancelar
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
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

function SummaryCard({
  label,
  value,
  tint,
}: {
  label: string;
  value: number;
  tint?: string;
}) {
  return (
    <div className="rounded-md border bg-card px-2 py-2 text-center">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "text-lg font-bold tabular-nums",
          tint && `text-${tint}`,
        )}
      >
        {value}
      </div>
    </div>
  );
}
