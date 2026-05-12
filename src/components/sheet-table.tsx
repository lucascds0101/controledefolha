import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OCC_META, eachDay, fmtDay, type OccType } from "@/lib/occurrence";
import { cn } from "@/lib/utils";
import { CellEditor, type CellOccurrence } from "./cell-editor";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import type { Period } from "./period-sidebar";

type Employee = { id: string; name: string; role: string | null; position: number };
type Occurrence = {
  id: string;
  employee_id: string;
  date: string;
  type: OccType;
  quantity: number | null;
  note: string | null;
};

export function SheetTable({ period, search }: { period: Period; search: string }) {
  const qc = useQueryClient();
  const days = useMemo(() => eachDay(period.start_date, period.end_date), [period]);

  const { data: employees = [] } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id,name,role,position")
        .eq("active", true)
        .order("position", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Employee[];
    },
  });

  const { data: occurrences = [] } = useQuery({
    queryKey: ["occurrences", period.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("occurrences")
        .select("id,employee_id,date,type,quantity,note")
        .eq("period_id", period.id);
      if (error) throw error;
      return (data ?? []) as Occurrence[];
    },
  });

  const occMap = useMemo(() => {
    const m = new Map<string, Occurrence[]>();
    for (const o of occurrences) {
      const k = `${o.employee_id}|${o.date}`;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(o);
    }
    return m;
  }, [occurrences]);

  const filtered = useMemo(
    () =>
      employees.filter((e) =>
        search.trim() === ""
          ? true
          : e.name.toLowerCase().includes(search.toLowerCase()) ||
            (e.role ?? "").toLowerCase().includes(search.toLowerCase()),
      ),
    [employees, search],
  );

  // Editor state
  const [editing, setEditing] = useState<{
    employee: Employee;
    date: string;
    rows: CellOccurrence[];
  } | null>(null);

  const saveCell = useMutation({
    mutationFn: async (rows: CellOccurrence[]) => {
      if (!editing) return;
      const { data: u } = await supabase.auth.getUser();
      // Replace strategy: delete existing + insert
      await supabase
        .from("occurrences")
        .delete()
        .eq("employee_id", editing.employee.id)
        .eq("date", editing.date)
        .eq("period_id", period.id);
      const valid = rows.filter((r) => r.type);
      if (valid.length) {
        const { error } = await supabase.from("occurrences").insert(
          valid.map((r) => ({
            user_id: u.user!.id,
            employee_id: editing.employee.id,
            period_id: period.id,
            date: editing.date,
            type: r.type,
            quantity: r.quantity,
            note: r.note?.trim() || null,
          })),
        );
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["occurrences", period.id] });
      setEditing(null);
      toast.success("Salvo");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Add employee
  const [openAdd, setOpenAdd] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const addEmp = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("employees").insert({
        user_id: u.user!.id,
        name,
        role: role || null,
        position: employees.length,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees"] });
      setName("");
      setRole("");
      setOpenAdd(false);
      toast.success("Colaborador adicionado");
    },
  });

  const removeEmp = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("employees").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employees"] }),
  });

  return (
    <>
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="flex items-center justify-between p-3 border-b bg-muted/40">
          <div>
            <h2 className="font-semibold">Folha de ocorrências</h2>
            <p className="text-xs text-muted-foreground">
              {days.length} dias · clique numa célula para registrar
            </p>
          </div>
          <Dialog open={openAdd} onOpenChange={setOpenAdd}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <UserPlus className="h-4 w-4" /> Novo colaborador
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo colaborador</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Nome</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Cargo (opcional)</Label>
                  <Input value={role} onChange={(e) => setRole(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => addEmp.mutate()}
                  disabled={!name.trim() || addEmp.isPending}
                >
                  Adicionar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="overflow-x-auto sheet-scroll">
          <table className="border-separate border-spacing-0 text-sm w-full">
            <thead className="sticky top-0 z-20">
              <tr>
                <th className="sticky left-0 z-30 bg-card border-b border-r min-w-[220px] text-left px-3 py-2 font-medium text-muted-foreground">
                  Colaborador
                </th>
                {days.map((d) => {
                  const f = fmtDay(d);
                  return (
                    <th
                      key={d}
                      className={cn(
                        "border-b border-r px-1 py-2 font-medium text-muted-foreground min-w-[56px]",
                        f.isWeekend && "bg-muted/40",
                      )}
                    >
                      <div className="text-[11px] uppercase">{f.weekday}</div>
                      <div className="text-foreground font-semibold">{f.day}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {filtered.map((emp) => (
                <tr key={emp.id} className="group">
                  <td className="sticky left-0 z-10 bg-card border-b border-r px-3 py-2 align-middle">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{emp.name}</div>
                        {emp.role && (
                          <div className="text-xs text-muted-foreground truncate">
                            {emp.role}
                          </div>
                        )}
                      </div>
                      <button
                        className="opacity-0 group-hover:opacity-60 hover:opacity-100 text-muted-foreground hover:text-destructive"
                        onClick={() => {
                          if (confirm(`Remover ${emp.name}?`)) removeEmp.mutate(emp.id);
                        }}
                        aria-label="Remover"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                  {days.map((d) => {
                    const items = occMap.get(`${emp.id}|${d}`) ?? [];
                    const f = fmtDay(d);
                    return (
                      <td
                        key={d}
                        className={cn(
                          "border-b border-r p-1 align-middle text-center cursor-pointer hover:bg-accent/40 transition",
                          f.isWeekend && "bg-muted/20",
                        )}
                        onClick={() =>
                          setEditing({
                            employee: emp,
                            date: d,
                            rows: items.map((i) => ({
                              id: i.id,
                              type: i.type,
                              quantity: i.quantity,
                              note: i.note,
                            })),
                          })
                        }
                      >
                        <div className="flex flex-wrap gap-0.5 justify-center min-h-[28px] items-center">
                          {items.length === 0 ? (
                            <span className="text-muted-foreground/30 text-xs">+</span>
                          ) : (
                            items.map((it) => {
                              const m = OCC_META[it.type];
                              return (
                                <span
                                  key={it.id}
                                  title={`${m.full}${it.quantity ? ` (${it.quantity}h)` : ""}${it.note ? ` — ${it.note}` : ""}`}
                                  className={cn(
                                    "inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-bold",
                                    m.bg,
                                    m.text,
                                  )}
                                >
                                  {m.label}
                                  {it.quantity ? (
                                    <span className="ml-0.5 font-medium opacity-80">
                                      {it.quantity}
                                    </span>
                                  ) : null}
                                </span>
                              );
                            })
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={days.length + 1}
                    className="text-center py-12 text-sm text-muted-foreground"
                  >
                    {employees.length === 0
                      ? "Adicione seu primeiro colaborador para começar."
                      : "Nenhum colaborador encontrado."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <CellEditor
          open={!!editing}
          onOpenChange={(o) => !o && setEditing(null)}
          employeeName={editing.employee.name}
          date={editing.date}
          initial={editing.rows}
          onSave={async (r) => saveCell.mutateAsync(r)}
        />
      )}
    </>
  );
}
