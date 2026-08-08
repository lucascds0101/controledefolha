import { useEffect, useMemo, useState } from "react";
import { Trash2, Plus, CheckCircle2, Clock } from "lucide-react";
import {
  EDITOR_META,
  EDITOR_TYPES,
  FALTA_REASONS,
  SAIDA_REASONS,
  SANCTION_KINDS,
  faltaMeta,
  type EditorType,
} from "@/lib/occurrence";
import type { DayType } from "./day-type-cell";
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
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export type CellOccurrence = {
  id?: string;
  /** id of the medical leave / swap record when editing an existing one */
  recordId?: string;
  type: EditorType;
  arrival_time: string | null;
  partner_name: string | null;
  reason: string | null;
  covered: boolean | null;
  covered_by: string | null;
  exit_time: string | null;
  return_time: string | null;
  note: string | null;
  // Atestado (ATE)
  start_date?: string | null;
  days?: number | null;
  cid?: string | null;
  // Troca casada (TC)
  work_date?: string | null;
  off_date?: string | null;
  work_confirmed?: boolean;
  off_confirmed?: boolean;
};

const EMPTY: CellOccurrence = {
  type: "A",
  arrival_time: null,
  partner_name: null,
  reason: null,
  covered: null,
  covered_by: null,
  exit_time: null,
  return_time: null,
  note: "",
  start_date: null,
  days: 1,
  cid: null,
  work_date: null,
  off_date: null,
  work_confirmed: false,
  off_confirmed: false,
};

export function CellEditor({
  open,
  onOpenChange,
  employeeName,
  date,
  dayType,
  initial,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  employeeName: string;
  date: string;
  dayType?: DayType;
  initial: CellOccurrence[];
  onSave: (rows: CellOccurrence[]) => Promise<void>;
}) {
  const [rows, setRows] = useState<CellOccurrence[]>(initial);
  const [saving, setSaving] = useState(false);

  // Extra (EX) is only allowed on Folga days; hide it on Plantão.
  const availableTypes = useMemo<EditorType[]>(() => {
    if (dayType === "plantao") return EDITOR_TYPES.filter((t) => t !== "EX");
    if (dayType === "folga") return ["EX", "TC", "ATE"];
    return EDITOR_TYPES;
  }, [dayType]);

  useEffect(() => {
    if (open) {
      const defaultType: EditorType = dayType === "folga" ? "EX" : "A";
      setRows(initial.length ? initial : [{ ...EMPTY, type: defaultType }]);
    }
  }, [open, initial, dayType]);

  function update(i: number, patch: Partial<CellOccurrence>) {
    setRows((r) => r.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  }

  function changeType(i: number, t: EditorType, note: string | null) {
    const base: CellOccurrence = { ...EMPTY, type: t, note };
    if (t === "ATE") {
      base.start_date = date;
      base.days = 1;
    }
    if (t === "TC") base.off_date = date;
    setRows((r) => r.map((x, idx) => (idx === i ? { ...base, recordId: x.recordId } : x)));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Editar ocorrências</DialogTitle>
          <DialogDescription>
            {employeeName} —{" "}
            {new Date(date + "T00:00:00").toLocaleDateString("pt-BR", {
              weekday: "long",
              day: "2-digit",
              month: "long",
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1 sheet-scroll">
          {rows.map((row, i) => {
            const fMeta = faltaMeta(row as { type: never; reason?: string | null });
            const meta = fMeta ?? EDITOR_META[row.type];
            const ateEnd =
              row.start_date && (row.days ?? 0) >= 1
                ? addDaysISO(row.start_date, (row.days ?? 1) - 1)
                : "";
            const swapDone = !!row.work_confirmed && !!row.off_confirmed;
            return (
              <div key={i} className={cn("rounded-lg border p-3 space-y-3", meta.bg)}>
                <div className="flex items-start gap-2">
                  <div className="flex-1 space-y-1.5">
                    <Label className="text-xs">Tipo de ocorrência</Label>
                    <Select
                      value={row.type}
                      onValueChange={(v) => changeType(i, v as EditorType, row.note)}
                    >
                      <SelectTrigger className="bg-card">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {availableTypes.map((t) => (
                          <SelectItem key={t} value={t}>
                            {EDITOR_META[t].full}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRows((r) => r.filter((_, idx) => idx !== i))}
                    className="text-muted-foreground hover:text-destructive p-1 mt-6"
                    aria-label="Remover"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {row.type === "A" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Horário de chegada</Label>
                    <Input
                      type="time"
                      value={row.arrival_time ?? ""}
                      onChange={(e) =>
                        update(i, { arrival_time: e.target.value || null })
                      }
                    />
                  </div>
                )}

                {row.type === "ATE" && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Início</Label>
                        <Input
                          type="date"
                          className="bg-card"
                          value={row.start_date ?? ""}
                          onChange={(e) =>
                            update(i, { start_date: e.target.value || null })
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Dias</Label>
                        <Input
                          type="number"
                          min={1}
                          className="bg-card"
                          value={row.days ?? 1}
                          onChange={(e) =>
                            update(i, {
                              days: Math.max(1, Number(e.target.value) || 1),
                            })
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Fim</Label>
                        <Input type="date" value={ateEnd} readOnly disabled />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">CID (opcional)</Label>
                      <Input
                        className="bg-card"
                        value={row.cid ?? ""}
                        onChange={(e) => update(i, { cid: e.target.value || null })}
                        placeholder="Ex.: J06.9"
                      />
                    </div>
                  </div>
                )}

                {row.type === "TC" && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">
                          Data de folga (colaborador)
                        </Label>
                        <Input
                          type="date"
                          className="bg-card"
                          value={row.off_date ?? ""}
                          onChange={(e) =>
                            update(i, { off_date: e.target.value || null })
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Data escolhida pelo outro</Label>
                        <Input
                          type="date"
                          className="bg-card"
                          value={row.work_date ?? ""}
                          onChange={(e) =>
                            update(i, { work_date: e.target.value || null })
                          }
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Nome do outro colaborador</Label>
                      <Input
                        className="bg-card"
                        value={row.partner_name ?? ""}
                        onChange={(e) =>
                          update(i, { partner_name: e.target.value || null })
                        }
                        placeholder="Digite o nome"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between rounded-md border bg-card p-2">
                        <Label className="text-xs">Folga confirmada</Label>
                        <Switch
                          checked={!!row.off_confirmed}
                          onCheckedChange={(c) => update(i, { off_confirmed: c })}
                        />
                      </div>
                      <div className="flex items-center justify-between rounded-md border bg-card p-2">
                        <Label className="text-xs">
                          Trabalho do outro confirmado
                        </Label>
                        <Switch
                          checked={!!row.work_confirmed}
                          onCheckedChange={(c) => update(i, { work_confirmed: c })}
                        />
                      </div>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold",
                          swapDone
                            ? "bg-occ-p-bg text-occ-p ring-1 ring-occ-p/30"
                            : "bg-occ-a-bg text-occ-a ring-1 ring-occ-a/40",
                        )}
                      >
                        {swapDone ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <Clock className="h-3 w-3" />
                        )}
                        {swapDone ? "Troca concluída" : "Troca pendente"}
                      </span>
                    </div>
                  </div>
                )}

                {row.type === "F" && (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Motivo</Label>
                      <Select
                        value={row.reason ?? ""}
                        onValueChange={(v) => update(i, { reason: v })}
                      >
                        <SelectTrigger className="bg-card">
                          <SelectValue placeholder="Selecione…" />
                        </SelectTrigger>
                        <SelectContent>
                          {FALTA_REASONS.map((r) => (
                            <SelectItem key={r} value={r}>
                              {r}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center justify-between rounded-md border bg-card p-2">
                      <Label className="text-xs">Posto coberto?</Label>
                      <Switch
                        checked={!!row.covered}
                        onCheckedChange={(c) =>
                          update(i, { covered: c, covered_by: c ? row.covered_by : null })
                        }
                      />
                    </div>
                    {row.covered && (
                      <div className="space-y-1.5">
                        <Label className="text-xs">Coberto por</Label>
                        <Input
                          placeholder="Nome do colaborador"
                          value={row.covered_by ?? ""}
                          onChange={(e) =>
                            update(i, { covered_by: e.target.value || null })
                          }
                        />
                      </div>
                    )}
                  </div>
                )}

                {row.type === "SA" && (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Motivo</Label>
                      <Select
                        value={row.reason ?? ""}
                        onValueChange={(v) => update(i, { reason: v })}
                      >
                        <SelectTrigger className="bg-card">
                          <SelectValue placeholder="Selecione…" />
                        </SelectTrigger>
                        <SelectContent>
                          {SAIDA_REASONS.map((r) => (
                            <SelectItem key={r} value={r}>
                              {r}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Horário de saída</Label>
                        <Input
                          type="time"
                          value={row.exit_time ?? ""}
                          onChange={(e) =>
                            update(i, { exit_time: e.target.value || null })
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Horário de retorno</Label>
                        <Input
                          type="time"
                          value={row.return_time ?? ""}
                          onChange={(e) =>
                            update(i, { return_time: e.target.value || null })
                          }
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label className="text-xs">Observação</Label>
                  <Textarea
                    rows={2}
                    value={row.note ?? ""}
                    onChange={(e) => update(i, { note: e.target.value })}
                    placeholder="Opcional"
                    className="bg-card"
                  />
                </div>
              </div>
            );
          })}

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => setRows((r) => [...r, { ...EMPTY }])}
          >
            <Plus className="h-4 w-4" /> Adicionar ocorrência
          </Button>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              try {
                await onSave(rows);
              } finally {
                setSaving(false);
              }
            }}
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
