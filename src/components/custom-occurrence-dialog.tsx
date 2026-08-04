import { useEffect, useState } from "react";
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
import { Trash2 } from "lucide-react";

function fmt(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
}

export function CustomOccurrenceDialog({
  open,
  onOpenChange,
  employeeName,
  start,
  end,
  initialLabel,
  saving,
  onSave,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  employeeName: string;
  start: string;
  end: string;
  initialLabel?: string;
  saving?: boolean;
  onSave: (label: string) => void;
  onDelete?: () => void;
}) {
  const [label, setLabel] = useState("");

  useEffect(() => {
    if (open) setLabel(initialLabel ?? "");
  }, [open, initialLabel]);

  const days = Math.round(
    (new Date(end + "T00:00:00").getTime() - new Date(start + "T00:00:00").getTime()) /
      86400000,
  ) + 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initialLabel ? "Editar ocorrência" : "Nova ocorrência"}</DialogTitle>
          <DialogDescription>
            {employeeName} · {fmt(start)}
            {start !== end && ` → ${fmt(end)}`} · {days} dia{days === 1 ? "" : "s"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label>Nome da ocorrência</Label>
          <Input
            autoFocus
            value={label}
            placeholder="Ex.: Treinamento, Licença, Curso…"
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && label.trim()) onSave(label.trim());
            }}
          />
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {onDelete ? (
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive gap-2"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" /> Excluir
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button disabled={!label.trim() || saving} onClick={() => onSave(label.trim())}>
              Salvar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
