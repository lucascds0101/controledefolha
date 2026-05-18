import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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
import { OCC_META, ATESTADO_META, eachDay, fmtDay, isAtestado, summaryFor, type OccType } from "@/lib/occurrence";
import { todayISO, dayState } from "@/lib/date-utils";
import { mondayKey } from "@/lib/schedule";
import { sortEmployees } from "@/lib/sort-employees";
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
import { toast } from "sonner";
import type { Period } from "./period-sidebar";
import { EmployeeEditDialog, type EmployeeEditable } from "./employee-edit-dialog";
import { DayTypeCell, type DayType } from "./day-type-cell";

type Role = { id: string; name: string };
type PE = {
  id: string;
  source_employee_id: string | null;
  name: string;
  role: string | null;
  position: number;
  vacant: boolean;
};
type Occurrence = {
  id: string;
  employee_id: string;
  date: string;
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
type PeriodDay = { id: string; date: string; day_type: NonNullable<DayType> };
type Vacation = {
  id: string;
  period_employee_id: string | null;
  source_employee_id: string | null;
  start_date: string;
  end_date: string;
};

export function SheetTable({ period, search }: { period: Period; search: string }) {
  const qc = useQueryClient();
  const days = useMemo(() => eachDay(period.start_date, period.end_date), [period]);
  const today = todayISO();

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

  const { data: employees = [] } = useQuery({
    queryKey: ["period_employees", period.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("period_employees")
        .select("id,source_employee_id,name,role,position,vacant")
        .eq("period_id", period.id)
        .order("position", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PE[];
    },
  });

  const { data: occurrences = [] } = useQuery({
    queryKey: ["occurrences", period.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("occurrences")
        .select(
          "id,employee_id,date,type,arrival_time,partner_name,reason,covered,covered_by,exit_time,return_time,note",
        )
        .eq("period_id", period.id);
      if (error) throw error;
      return (data ?? []) as Occurrence[];
    },
  });

  const { data: periodDays = [] } = useQuery({
    queryKey: ["period_days", period.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("period_days")
        .select("id,date,day_type")
        .eq("period_id", period.id);
      if (error) throw error;
      return (data ?? []) as PeriodDay[];
    },
  });

  const peIds = useMemo(() => employees.map((e) => e.id), [employees]);
  const sourceIds = useMemo(
    () => employees.map((e) => e.source_employee_id).filter((x): x is string => !!x),
    [employees],
  );

  const { data: vacations = [] } = useQuery({
    queryKey: ["vacations-by-period", period.id, peIds.length, sourceIds.length],
    enabled: peIds.length > 0,
    queryFn: async () => {
      const filters: string[] = [];
      if (peIds.length) filters.push(`period_employee_id.in.(${peIds.join(",")})`);
      if (sourceIds.length) filters.push(`source_employee_id.in.(${sourceIds.join(",")})`);
      const { data, error } = await supabase
        .from("employee_vacations")
        .select("id,period_employee_id,source_employee_id,start_date,end_date")
        .or(filters.join(","));
      if (error) throw error;
      return (data ?? []) as Vacation[];
    },
  });

  // Map: period_employee_id -> Set<date ISO> covered by any vacation, clipped
  // to the current period range so we only paint days within this folha.
  const vacByEmp = useMemo(() => {
    const out = new Map<string, Set<string>>();
    const pstart = period.start_date;
    const pend = period.end_date;
    const bySource = new Map<string, PE[]>();
    for (const e of employees) {
      if (e.source_employee_id) {
        const arr = bySource.get(e.source_employee_id) ?? [];
        arr.push(e);
        bySource.set(e.source_employee_id, arr);
      }
    }
    for (const v of vacations) {
      const s = v.start_date > pstart ? v.start_date : pstart;
      const e = v.end_date < pend ? v.end_date : pend;
      if (s > e) continue;
      const dates = eachDay(s, e);
      const targets: string[] = [];
      if (v.period_employee_id) targets.push(v.period_employee_id);
      if (v.source_employee_id) {
        const matches = bySource.get(v.source_employee_id) ?? [];
        for (const pe of matches) targets.push(pe.id);
      }
      for (const t of targets) {
        let set = out.get(t);
        if (!set) {
          set = new Set();
          out.set(t, set);
        }
        for (const d of dates) set.add(d);
      }
    }
    return out;
  }, [vacations, employees, period.start_date, period.end_date]);

  const dayTypeMap = useMemo(() => {
    const m = new Map<string, PeriodDay>();
    for (const p of periodDays) m.set(p.date, p);
    return m;
  }, [periodDays]);

  const occMap = useMemo(() => {
    const m = new Map<string, Occurrence[]>();
    for (const o of occurrences) {
      const k = `${o.employee_id}|${o.date}`;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(o);
    }
    return m;
  }, [occurrences]);

  const filtered = useMemo(() => {
    const list = employees.filter((e) => {
      if (search.trim() === "") return true;
      const q = search.toLowerCase();
      const display = e.vacant ? "vago" : e.name.toLowerCase();
      return display.includes(q) || (e.role ?? "").toLowerCase().includes(q);
    });
    return sortEmployees(list);
  }, [employees, search]);

  const [editing, setEditing] = useState<{
    employee: PE;
    date: string;
    rows: CellOccurrence[];
  } | null>(null);

  const saveCell = useMutation({
    mutationFn: async (rows: CellOccurrence[]) => {
      if (!editing) return;
      const { data: u } = await supabase.auth.getUser();
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
            arrival_time: r.arrival_time,
            partner_name: r.partner_name,
            reason: r.reason,
            covered: r.covered,
            covered_by: r.covered_by,
            exit_time: r.exit_time,
            return_time: r.return_time,
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

  const [openAdd, setOpenAdd] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState<string>("");
  const addEmp = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("period_employees").insert({
        user_id: u.user!.id,
        period_id: period.id,
        name,
        role: role || null,
        position: employees.length,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["period_employees", period.id] });
      setName("");
      setRole("");
      setOpenAdd(false);
      toast.success("Colaborador adicionado neste período");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeEmp = useMutation({
    mutationFn: async (id: string) => {
      // Remove also occurrences for this employee in this period to keep data tidy.
      await supabase
        .from("occurrences")
        .delete()
        .eq("employee_id", id)
        .eq("period_id", period.id);
      const { error } = await supabase.from("period_employees").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["period_employees", period.id] });
      qc.invalidateQueries({ queryKey: ["occurrences", period.id] });
    },
  });

  const [editingEmp, setEditingEmp] = useState<EmployeeEditable | null>(null);

  const totalCount = employees.length;
  const vacantCount = employees.filter((e) => e.vacant).length;

  return (
    <>
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="flex items-center justify-between p-3 border-b bg-muted/40">
          <div>
            <h2 className="font-semibold">Folha de ocorrências</h2>
            <p className="text-xs text-muted-foreground">
              {days.length} dias · {totalCount} colaborador{totalCount === 1 ? "" : "es"}
              {vacantCount > 0 && ` · ${vacantCount} vago${vacantCount === 1 ? "" : "s"}`}
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
                <DialogTitle>Novo colaborador (somente neste período)</DialogTitle>
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
                      <SelectValue placeholder="Selecione…" />
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
                <th className="sticky left-0 z-30 bg-card border-b border-r min-w-[240px] text-left px-3 py-2 font-medium text-muted-foreground">
                  Colaborador
                </th>
                {days.map((d) => {
                  const f = fmtDay(d);
                  const pd = dayTypeMap.get(d);
                  const ds = dayState(d, today);
                  return (
                    <th
                      key={d}
                      className={cn(
                        "border-b border-r px-1 py-1.5 font-medium text-muted-foreground min-w-[64px] align-top transition-colors",
                        f.isWeekend ? "bg-muted/40" : "bg-card",
                        ds === "today" && "bg-primary/10 ring-1 ring-primary/40 relative",
                        ds === "future" && "opacity-60",
                      )}
                    >
                      <div className="text-[11px] uppercase">{f.weekday}</div>
                      <div
                        className={cn(
                          "font-semibold",
                          ds === "today" ? "text-primary" : "text-foreground",
                        )}
                      >
                        {f.day}
                      </div>
                      <DayTypeCell
                        periodId={period.id}
                        date={d}
                        current={pd?.day_type ?? null}
                        existingId={pd?.id}
                      />
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
                        {emp.vacant ? (
                          <div className="font-bold text-muted-foreground tracking-wider">
                            VAGO
                          </div>
                        ) : (
                          <div className="font-medium truncate">{emp.name}</div>
                        )}
                        {emp.role && (
                          <div className="text-xs text-muted-foreground truncate">
                            {emp.role}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
                        <button
                          className="text-muted-foreground hover:text-foreground p-1"
                          onClick={() =>
                            setEditingEmp({
                              id: emp.id,
                              source_employee_id: emp.source_employee_id,
                              name: emp.name,
                              role: emp.role,
                              vacant: emp.vacant,
                            })
                          }
                          aria-label="Editar"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          className="text-muted-foreground hover:text-destructive p-1"
                          onClick={() => {
                            if (
                              confirm(
                                `Remover ${emp.vacant ? "este posto" : emp.name} apenas deste período?`,
                              )
                            )
                              removeEmp.mutate(emp.id);
                          }}
                          aria-label="Remover"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </td>
                  {days.map((d) => {
                    const items = occMap.get(`${emp.id}|${d}`) ?? [];
                    const f = fmtDay(d);
                    const ds = dayState(d, today);
                    const dt = dayTypeMap.get(d)?.day_type ?? null;
                    const onVac = vacByEmp.get(emp.id)?.has(d) ?? false;
                    const autoPresent =
                      !onVac &&
                      items.length === 0 &&
                      dt === "plantao" &&
                      (ds === "past" || ds === "today") &&
                      !emp.vacant;
                    return (
                      <td
                        key={d}
                        className={cn(
                          "border-b border-r p-1 align-middle text-center cursor-pointer hover:bg-accent/40 transition",
                          f.isWeekend && "bg-muted/20",
                          ds === "today" && "bg-primary/5 ring-1 ring-inset ring-primary/30",
                          ds === "future" && "opacity-60",
                          autoPresent && "bg-occ-p-bg/60",
                          onVac && "bg-occ-fer-bg/60",
                        )}
                        onClick={() =>
                          setEditing({
                            employee: emp,
                            date: d,
                            rows: items.map((i) => ({
                              id: i.id,
                              type: i.type,
                              arrival_time: i.arrival_time,
                              partner_name: i.partner_name,
                              reason: i.reason,
                              covered: i.covered,
                              covered_by: i.covered_by,
                              exit_time: i.exit_time,
                              return_time: i.return_time,
                              note: i.note,
                            })),
                          })
                        }
                      >
                        <div className="flex flex-wrap gap-0.5 justify-center min-h-[28px] items-center">
                          {onVac && (
                            <span
                              title="Férias"
                              className="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-occ-fer-bg text-occ-fer"
                            >
                              FER
                            </span>
                          )}
                          {items.length === 0 && !onVac ? (
                            autoPresent ? (
                              <span
                                title="Presença confirmada (plantão sem ocorrências)"
                                className="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-occ-p-bg text-occ-p"
                              >
                                P
                              </span>
                            ) : (
                              <span className="text-muted-foreground/30 text-xs">+</span>
                            )
                          ) : null}
                          {items.map((it) => {
                            const m = OCC_META[it.type];
                            if (!m) return null;
                            return (
                              <span
                                key={it.id}
                                title={`${m.full} — ${summaryFor(it)}${it.note ? ` (${it.note})` : ""}`}
                                className={cn(
                                  "inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-bold",
                                  m.bg,
                                  m.text,
                                )}
                              >
                                {m.label}
                              </span>
                            );
                          })}
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
          employeeName={editing.employee.vacant ? "VAGO" : editing.employee.name}
          date={editing.date}
          initial={editing.rows}
          onSave={async (r) => saveCell.mutateAsync(r)}
        />
      )}

      <EmployeeEditDialog
        employee={editingEmp}
        periodId={period.id}
        open={!!editingEmp}
        onOpenChange={(o) => !o && setEditingEmp(null)}
      />
    </>
  );
}
