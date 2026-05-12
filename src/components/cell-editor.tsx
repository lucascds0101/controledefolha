import { useEffect, useState } from "react";
import { Trash2, Plus } from "lucide-react";
import { OCC_META, OCC_TYPES, type OccType } from "@/lib/occurrence";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  quantity: number | null;
  note: string | null;
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
    if (open) setRows(initial.length ? initial : [{ type: "A", quantity: null, note: "" }]);
  }, [open, initial]);

  function update(i: number, patch: Partial<CellOccurrence>) {
    setRows((r) => r.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
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

        <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1 sheet-scroll">
          {rows.map((row, i) => {
            const meta = OCC_META[row.type];
            return (
              <div
                key={i}
                className={cn("rounded-lg border p-3 space-y-3", meta.bg)}
              >
                <div className="flex items-start gap-3">
                  <div className="grid grid-cols-6 gap-1.5 flex-1">
                    {OCC_TYPES.map((t) => {
                      const m = OCC_META[t];
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => update(i, { type: t })}
                          className={cn(
                            "h-9 rounded-md text-xs font-semibold transition border",
                            row.type === t
                              ? `${m.bg} ${m.text} border-current ring-2 ${m.ring}`
                              : "bg-card text-muted-foreground border-border hover:bg-muted",
                          )}
                          title={m.full}
                        >
                          {m.label}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={() => setRows((r) => r.filter((_, idx) => idx !== i))}
                    className="text-muted-foreground hover:text-destructive p-1"
                    aria-label="Remover"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Quantidade (h)</Label>
                    <Input
                      type="number"
                      step="0.25"
                      min="0"
                      value={row.quantity ?? ""}
                      onChange={(e) =>
                        update(i, {
                          quantity: e.target.value === "" ? null : Number(e.target.value),
                        })
                      }
                      placeholder="—"
                    />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <Label className="text-xs">Observação</Label>
                    <Textarea
                      rows={1}
                      value={row.note ?? ""}
                      onChange={(e) => update(i, { note: e.target.value })}
                      placeholder="Opcional"
                    />
                  </div>
                </div>
              </div>
            );
          })}

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() =>
              setRows((r) => [...r, { type: "A", quantity: null, note: "" }])
            }
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
              await onSave(rows);
              setSaving(false);
            }}
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
