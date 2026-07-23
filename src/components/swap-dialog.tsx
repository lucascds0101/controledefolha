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
import { Check, CheckCircle2, Clock, Calendar, Trash2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { todayISO } from "@/lib/date-utils";
import type { Period } from "./period-sidebar";

type Swap = {
  id: string;
  period_employee_id: string;
  source_employee_id: string | null;
  partner_name: string | null;
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
      return "bg-occ-p-bg text-occ-p ring-1 ring-occ-p/30";
    case "Pendente de confirmação":
      return "bg-occ-a-bg text-occ-a ring-1 ring-occ-a/40";
    case "Cancelada":
      return "bg-muted text-muted-foreground line-through";
    default:
      return "bg-occ-tc-bg text-occ-tc ring-1 ring-occ-tc/30";
  }
}

function StatusIcon({ s }: { s: LegStatus }) {
  const cls = "h-3 w-3";
  switch (s) {
    case "Confirmada":
      return <CheckCircle2 className={cls} />;
    case "Pendente de confirmação":
      return <Clock className={cls} />;
    case "Cancelada":
      return <XCircle className={cls} />;
    default:
      return <Calendar className={cls} />;
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
          "id,period_employee_id,source_employee_id,partner_name,work_date,off_date,work_confirmed,work_confirmed_at,off_confirmed,off_confirmed_at,canceled,canceled_at,note",
        )
        .gte("off_date", period.start_date)
        .lte("off_date", period.end_date);
      if (sourceEmployeeId) {
        q = q.or(
          `source_employee_id.eq.${sourceEmployeeId},period_employee_id.eq.${periodEmployeeId}`,
        );
      } else {
        q = q.eq("period_employee_id", periodEmployeeId!);
      }
      const { data, error } = await q.order("off_date");
      if (error) throw error;
      return (data ?? []) as Swap[];
    },
  });

  // "Meu lado": off_date = data em que o colaborador vai folgar
  // "Outro lado": partner_name (texto livre) + work_date = data escolhida pelo outro
  const [myOffDate, setMyOffDate] = useState("");
  const [partnerName, setPartnerName] = useState("");
  const [partnerDate, setPartnerDate] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) {
      setMyOffDate("");
      setPartnerName("");
      setPartnerDate("");
      setNote("");
    }
  }, [open]);

  const activeCount = useMemo(
    () => swaps.filter((s) => !s.canceled).length,
    [swaps],
  );
  const atLimit = activeCount >= 2;

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
    if (!myOffDate) return "Informe a data de folga do colaborador.";
    if (!partnerName.trim()) return "Informe o nome do outro colaborador.";
    if (!partnerDate) return "Informe a data escolhida pelo outro colaborador.";
    if (myOffDate === partnerDate)
      return "As duas datas da troca não podem ser iguais.";
    if (myOffDate < period.start_date || myOffDate > period.end_date)
      return "A data de folga precisa estar dentro do período da folha.";
    if (atLimit)
      return "Este colaborador já atingiu o limite de 2 trocas casadas neste período.";
    return null;
  }

  const add = useMutation({
    mutationFn: async () => {
      const err = validate();
      if (err) throw new Error(err);
      const { data: u } = await supabase.auth.getUser();
      if (!periodEmployeeId) throw new Error("Colaborador inválido.");
      const { error } = await supabase.from("employee_swaps").insert({
        user_id: u.user!.id,
        period_employee_id: periodEmployeeId,
        source_employee_id: sourceEmployeeId,
        partner_name: partnerName.trim(),
        work_date: partnerDate,
        off_date: myOffDate,
        note: note.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["swaps"] });
      qc.invalidateQueries({ queryKey: ["swaps-by-period", period.id] });
      setMyOffDate("");
      setPartnerName("");
      setPartnerDate("");
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

  const validationMsg =
    myOffDate || partnerName || partnerDate ? validate() : null;

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
          <div className="rounded-lg border p-3 space-y-4 bg-card">
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Meu lado da troca
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Data escolhida pelo colaborador (folga)</Label>
                <Input
                  type="date"
                  min={period.start_date}
                  max={period.end_date}
                  value={myOffDate}
                  onChange={(e) => setMyOffDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2 pt-1 border-t">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pt-2">
                Outro lado da troca
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Nome do outro colaborador</Label>
                  <Input
                    type="text"
                    value={partnerName}
                    onChange={(e) => setPartnerName(e.target.value)}
                    placeholder="Digite o nome"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Data escolhida pelo colaborador</Label>
                  <Input
                    type="date"
                    value={partnerDate}
                    onChange={(e) => setPartnerDate(e.target.value)}
                  />
                </div>
              </div>
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
                !myOffDate ||
                !partnerName.trim() ||
                !partnerDate ||
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
                const canConfirmOff =
                  !s.canceled && !s.off_confirmed && s.off_date <= today;
                const canConfirmWork =
                  !s.canceled && !s.work_confirmed && s.work_date <= today;
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
                            Folga {fmtBR(s.off_date)}
                          </span>{" "}
                          <span className="text-muted-foreground">↔</span>{" "}
                          <span className="font-medium">
                            {s.partner_name || "—"}: {fmtBR(s.work_date)}
                          </span>
                        </div>
                        {s.note && (
                          <div className="text-xs text-muted-foreground">
                            {s.note}
                          </div>
                        )}
                        <div className="flex flex-wrap gap-1 pt-1">
                          <span
                            className={cn(
                              "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold",
                              statusClass(oStatus),
                            )}
                          >
                            Minha folga: {oStatus}
                          </span>
                          <span
                            className={cn(
                              "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold",
                              statusClass(wStatus),
                            )}
                          >
                            Outro: {wStatus}
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
                        {canConfirmOff && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 h-7"
                            onClick={() =>
                              confirmLeg.mutate({ id: s.id, leg: "off" })
                            }
                          >
                            <Check className="h-3.5 w-3.5" /> Confirmar minha folga
                          </Button>
                        )}
                        {canConfirmWork && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 h-7"
                            onClick={() =>
                              confirmLeg.mutate({ id: s.id, leg: "work" })
                            }
                          >
                            <Check className="h-3.5 w-3.5" /> Confirmar outro
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
