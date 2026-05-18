import { useEffect, useMemo, useState } from "react";
import { Trash2, Plus } from "lucide-react";
import {
  OCC_META,
  OCC_TYPES,
  ATESTADO_META,
  FALTA_REASONS,
  SAIDA_REASONS,
  isAtestado,
  type OccType,
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

export type CellOccurrence = {
  id?: string;
  type: OccType;
  arrival_time: string | null;
  partner_name: string | null;
  reason: string | null;
  covered: boolean | null;
  covered_by: string | null;
  exit_time: string | null;
  return_time: string | null;
  note: string | null;
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
};

export function CellEditor({
  open,
  onOpenChange,
  employeeName,
  date,
  initial,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  employeeName: string;
  date: string;
  initial: CellOccurrence[];
  onSave: (rows: CellOccurrence[]) => Promise<void>;
}) {
  const [rows, setRows] = useState<CellOccurrence[]>(initial);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setRows(initial.length ? initial : [{ ...EMPTY }]);
  }, [open, initial]);

  function update(i: number, patch: Partial<CellOccurrence>) {
    setRows((r) => r.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
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
            const meta = OCC_META[row.type];
            return (
              <div key={i} className={cn("rounded-lg border p-3 space-y-3", meta.bg)}>
                <div className="flex items-start gap-2">
                  <div className="flex-1 space-y-1.5">
                    <Label className="text-xs">Tipo de ocorrência</Label>
                    <Select
                      value={row.type}
                      onValueChange={(v) =>
                        update(i, { ...EMPTY, type: v as OccType, note: row.note })
                      }
                    >
                      <SelectTrigger className="bg-card">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {OCC_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {OCC_META[t].full}
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

                {row.type === "TC" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Trocou com</Label>
                    <Input
                      placeholder="Nome do colaborador"
                      value={row.partner_name ?? ""}
                      onChange={(e) =>
                        update(i, { partner_name: e.target.value || null })
                      }
                    />
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
