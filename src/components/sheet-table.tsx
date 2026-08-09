import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock, Pencil, Search, Trash2, UserPlus, X } from "lucide-react";
import { Link } from "@tanstack/react-router";

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
import { OCC_META, eachDay, fmtDay, faltaMeta, summaryFor, type OccType } from "@/lib/occurrence";
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
import { CustomOccurrenceDialog } from "./custom-occurrence-dialog";

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
type MedicalLeave = Vacation & {
  days: number;
  cid: string | null;
  note: string | null;
};
type Swap = {
  id: string;
  period_employee_id: string;
  source_employee_id: string | null;
  partner_name: string | null;
  work_date: string;
  off_date: string;
  work_confirmed: boolean;
  off_confirmed: boolean;
  canceled: boolean;
  note: string | null;
};
type CustomOcc = {
  id: string;
  period_employee_id: string;
  label: string;
  start_date: string;
  end_date: string;
};

function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function SheetTable({ period, search, onSearchChange }: { period: Period; search: string; onSearchChange: (v: string) => void }) {
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

  const { data: medicalLeaves = [] } = useQuery({
    queryKey: ["medical-leaves-by-period", period.id, peIds.length, sourceIds.length],
    enabled: peIds.length > 0,
    queryFn: async () => {
      const filters: string[] = [];
      if (peIds.length) filters.push(`period_employee_id.in.(${peIds.join(",")})`);
      if (sourceIds.length) filters.push(`source_employee_id.in.(${sourceIds.join(",")})`);
      const { data, error } = await supabase
        .from("employee_medical_leaves")
        .select("id,period_employee_id,source_employee_id,start_date,end_date,days,cid,note")
        .or(filters.join(","));
      if (error) throw error;
      return (data ?? []) as MedicalLeave[];
    },
  });

  const { data: swaps = [] } = useQuery({
    queryKey: ["swaps-by-period", period.id, peIds.length, sourceIds.length],
    enabled: peIds.length > 0,
    queryFn: async () => {
      const filters: string[] = [];
      if (peIds.length) filters.push(`period_employee_id.in.(${peIds.join(",")})`);
      if (sourceIds.length) filters.push(`source_employee_id.in.(${sourceIds.join(",")})`);
      const { data, error } = await supabase
        .from("employee_swaps")
        .select(
          "id,period_employee_id,source_employee_id,partner_name,work_date,off_date,work_confirmed,off_confirmed,canceled,note",
        )
        .eq("canceled", false)
        .or(filters.join(","));
      if (error) throw error;
      return (data ?? []) as Swap[];
    },
  });

  const { data: customs = [] } = useQuery({
    queryKey: ["custom-occ", period.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_occurrences")
        .select("id,period_employee_id,label,start_date,end_date")
        .eq("period_id", period.id);
      if (error) throw error;
      return (data ?? []) as CustomOcc[];
    },
  });

  // Map: `${period_employee_id}|${date}` -> custom occurrence covering that day.
  const customByCell = useMemo(() => {
    const out = new Map<string, CustomOcc>();
    for (const c of customs) {
      const s = c.start_date > period.start_date ? c.start_date : period.start_date;
      const e = c.end_date < period.end_date ? c.end_date : period.end_date;
      if (s > e) continue;
      for (const d of eachDay(s, e)) out.set(`${c.period_employee_id}|${d}`, c);
    }
    return out;
  }, [customs, period.start_date, period.end_date]);


  // Map: period_employee_id -> Set<date ISO> covered by a date-range record
  // (vacation or medical leave), clipped to the current period range.
  const buildRangeMap = (ranges: Vacation[]) => {
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
    for (const v of ranges) {
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
  };

  const vacByEmp = useMemo(
    () => buildRangeMap(vacations),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [vacations, employees, period.start_date, period.end_date],
  );
  // Map: period_employee_id -> (date -> contiguous medical-leave segment),
  // clipped to the current period so the grid can render a merged block.
  type MedSegment = { id: string; start: string; end: string };
  const medSegByEmp = useMemo(() => {
    const out = new Map<string, Map<string, MedSegment>>();
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
    for (const v of medicalLeaves) {
      const s = v.start_date > pstart ? v.start_date : pstart;
      const e = v.end_date < pend ? v.end_date : pend;
      if (s > e) continue;
      const seg: MedSegment = { id: v.id, start: s, end: e };
      const targets: string[] = [];
      if (v.period_employee_id) targets.push(v.period_employee_id);
      if (v.source_employee_id) {
        for (const pe of bySource.get(v.source_employee_id) ?? []) targets.push(pe.id);
      }
      for (const t of targets) {
        let m = out.get(t);
        if (!m) {
          m = new Map();
          out.set(t, m);
        }
        for (const d of eachDay(s, e)) m.set(d, seg);
      }
    }
    return out;
  }, [medicalLeaves, employees, period.start_date, period.end_date]);
  // Map: period_employee_id -> (date -> contiguous custom-occurrence segment),
  // clipped to the current period so the grid can render a merged white block.
  type CustomSegment = { id: string; start: string; end: string; label: string };
  const customSegByEmp = useMemo(() => {
    const out = new Map<string, Map<string, CustomSegment>>();
    const pstart = period.start_date;
    const pend = period.end_date;
    for (const c of customs) {
      const s = c.start_date > pstart ? c.start_date : pstart;
      const e = c.end_date < pend ? c.end_date : pend;
      if (s > e) continue;
      const seg: CustomSegment = { id: c.id, start: s, end: e, label: c.label };
      let m = out.get(c.period_employee_id);
      if (!m) {
        m = new Map();
        out.set(c.period_employee_id, m);
      }
      for (const d of eachDay(s, e)) m.set(d, seg);
    }
    return out;
  }, [customs, period.start_date, period.end_date]);



  // Map: `${period_employee_id}|${date}` -> swap leg on that date.
  const swapByCell = useMemo(() => {
    const out = new Map<string, { swap: Swap; leg: "work" | "off" }>();
    const bySource = new Map<string, PE[]>();
    for (const e of employees) {
      if (e.source_employee_id) {
        const arr = bySource.get(e.source_employee_id) ?? [];
        arr.push(e);
        bySource.set(e.source_employee_id, arr);
      }
    }
    for (const s of swaps) {
      const targets: string[] = [];
      if (s.period_employee_id) targets.push(s.period_employee_id);
      if (s.source_employee_id) {
        for (const pe of bySource.get(s.source_employee_id) ?? []) targets.push(pe.id);
      }
      for (const leg of ["work", "off"] as const) {
        const d = leg === "work" ? s.work_date : s.off_date;
        if (d < period.start_date || d > period.end_date) continue;
        for (const t of targets) out.set(`${t}|${d}`, { swap: s, leg });
      }
    }
    return out;
  }, [swaps, employees, period.start_date, period.end_date]);


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
      const emp = editing.employee;
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user!.id;

      const empDisplay = emp.vacant ? "VAGO" : emp.name;

      /** Creates/updates the automatic 7-day block bound to an occurrence record. */
      async function syncAutoBlock(
        sourceId: string,
        kind: "falta" | "atestado",
        startISO: string,
      ) {
        const payload = {
          user_id: uid,
          period_employee_id: emp.id,
          source_employee_id: emp.source_employee_id,
          employee_name: empDisplay,
          reason: kind === "falta" ? "Falta injustificada" : "Atestado",
          start_date: startISO,
          end_date: autoBlockEnd(startISO),
          origin: "auto",
          source_kind: kind,
          source_id: sourceId,
        };
        const { data: found } = await supabase
          .from("employee_blocks")
          .select("id")
          .eq("source_id", sourceId)
          .maybeSingle();
        if (found) {
          await supabase
            .from("employee_blocks")
            .update({
              start_date: payload.start_date,
              end_date: payload.end_date,
              reason: payload.reason,
              employee_name: empDisplay,
            })
            .eq("id", found.id);
        } else {
          await supabase.from("employee_blocks").insert(payload);
        }
      }

      async function dropAutoBlocks(sourceIds: string[]) {
        if (!sourceIds.length) return;
        await supabase
          .from("employee_blocks")
          .delete()
          .eq("origin", "auto")
          .in("source_id", sourceIds);
      }

      // --- Standard occurrences (stored in `occurrences`) ---
      const { data: previous } = await supabase
        .from("occurrences")
        .select("id")
        .eq("employee_id", emp.id)
        .eq("date", editing.date)
        .eq("period_id", period.id);
      await dropAutoBlocks((previous ?? []).map((p) => p.id));
      await supabase
        .from("occurrences")
        .delete()
        .eq("employee_id", emp.id)
        .eq("date", editing.date)
        .eq("period_id", period.id);
      const std = rows.filter((r) => r.type !== "ATE" && r.type !== "TC");
      if (std.length) {
        const { data: inserted, error } = await supabase
          .from("occurrences")
          .insert(
            std.map((r) => ({
              user_id: uid,
              employee_id: emp.id,
              period_id: period.id,
              date: editing.date,
              type: r.type as OccType,
              arrival_time: r.arrival_time,
              partner_name: r.partner_name,
              reason: r.reason,
              covered: r.covered,
              covered_by: r.covered_by,
              exit_time: r.exit_time,
              return_time: r.return_time,
              note: r.note?.trim() || null,
            })),
          )
          .select("id,type,reason,date");
        if (error) throw error;
        for (const o of inserted ?? []) {
          if (isInjustificada({ type: o.type as OccType, reason: o.reason })) {
            await syncAutoBlock(o.id, "falta", o.date);
          }
        }
      }

      // --- Atestados (stored in `employee_medical_leaves`) ---
      for (const r of rows.filter((r) => r.type === "ATE")) {
        const start = r.start_date || editing.date;
        const nDays = Math.max(1, r.days ?? 1);
        const payload = {
          start_date: start,
          days: nDays,
          end_date: addDaysISO(start, nDays - 1),
          cid: r.cid?.trim() || null,
          note: r.note?.trim() || null,
        };
        if (r.recordId) {
          const { error } = await supabase
            .from("employee_medical_leaves")
            .update(payload)
            .eq("id", r.recordId);
          if (error) throw error;
          await syncAutoBlock(r.recordId, "atestado", start);
        } else {
          const { data: ins, error } = await supabase
            .from("employee_medical_leaves")
            .insert({
              user_id: uid,
              period_employee_id: emp.id,
              source_employee_id: emp.source_employee_id,
              ...payload,
            })
            .select("id")
            .single();
          if (error) throw error;
          if (ins) await syncAutoBlock(ins.id, "atestado", start);
        }
      }

      // --- Trocas casadas (stored in `employee_swaps`) ---
      for (const r of rows.filter((r) => r.type === "TC")) {
        const off = r.off_date || editing.date;
        if (!r.work_date)
          throw new Error("Informe a data escolhida pelo outro colaborador.");
        if (!r.partner_name?.trim())
          throw new Error("Informe o nome do outro colaborador.");
        if (off === r.work_date)
          throw new Error("As duas datas da troca não podem ser iguais.");
        const now = new Date().toISOString();
        const payload = {
          partner_name: r.partner_name.trim(),
          work_date: r.work_date,
          off_date: off,
          work_confirmed: !!r.work_confirmed,
          work_confirmed_at: r.work_confirmed ? now : null,
          off_confirmed: !!r.off_confirmed,
          off_confirmed_at: r.off_confirmed ? now : null,
          note: r.note?.trim() || null,
        };
        if (r.recordId) {
          const { error } = await supabase
            .from("employee_swaps")
            .update(payload)
            .eq("id", r.recordId);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("employee_swaps").insert({
            user_id: uid,
            period_employee_id: emp.id,
            source_employee_id: emp.source_employee_id,
            ...payload,
          });
          if (error) throw error;
        }
      }

      // --- Removals: records present initially but dropped in the editor ---
      const kept = new Set(rows.map((r) => r.recordId).filter(Boolean) as string[]);
      for (const r of editing.rows) {
        if (!r.recordId || kept.has(r.recordId)) continue;
        const table = r.type === "ATE" ? "employee_medical_leaves" : "employee_swaps";
        if (r.type !== "ATE" && r.type !== "TC") continue;
        if (r.type === "ATE") await dropAutoBlocks([r.recordId]);
        const { error } = await supabase.from(table).delete().eq("id", r.recordId);
        if (error) throw error;
      }

    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["occurrences", period.id] });
      qc.invalidateQueries({ queryKey: ["medical-leaves"] });
      qc.invalidateQueries({ queryKey: ["medical-leaves-by-period"] });
      qc.invalidateQueries({ queryKey: ["swaps"] });
      qc.invalidateQueries({ queryKey: ["profile-swaps"] });
      qc.invalidateQueries({ queryKey: ["swaps-by-period"] });
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
  const medById = useMemo(() => {
    const m = new Map<string, MedicalLeave>();
    for (const l of medicalLeaves) m.set(l.id, l);
    return m;
  }, [medicalLeaves]);
  const [hoverSeg, setHoverSeg] = useState<string | null>(null);
  const [hoverCustom, setHoverCustom] = useState<string | null>(null);

  // ---- Google Calendar style range selection (drag across a single row) ----
  type Sel = { empId: string; a: number; b: number };
  const [sel, setSel] = useState<Sel | null>(null);
  const selRef = useRef<Sel | null>(null);
  const draggingRef = useRef(false);
  const clickRef = useRef<(() => void) | null>(null);
  const [pendingSel, setPendingSel] = useState<{
    emp: PE;
    start: string;
    end: string;
  } | null>(null);
  const [editCustom, setEditCustom] = useState<{ occ: CustomOcc; emp: PE } | null>(null);

  const setSelection = (v: Sel | null) => {
    selRef.current = v;
    setSel(v);
  };

  const startDrag = (empId: string, idx: number, onClick: () => void) => {
    draggingRef.current = true;
    clickRef.current = onClick;
    setSelection({ empId, a: idx, b: idx });
  };

  const extendDrag = (empId: string, idx: number) => {
    const cur = selRef.current;
    if (!draggingRef.current || !cur || cur.empId !== empId || cur.b === idx) return;
    setSelection({ ...cur, b: idx });
  };

  useEffect(() => {
    const up = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      const cur = selRef.current;
      setSelection(null);
      if (!cur) return;
      if (cur.a === cur.b) {
        clickRef.current?.();
      } else {
        const i = Math.min(cur.a, cur.b);
        const j = Math.max(cur.a, cur.b);
        const emp = employees.find((e) => e.id === cur.empId);
        if (emp) setPendingSel({ emp, start: days[i], end: days[j] });
      }
      clickRef.current = null;
    };
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, [employees, days]);

  const createCustom = useMutation({
    mutationFn: async (label: string) => {
      if (!pendingSel) return;
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("custom_occurrences").insert({
        user_id: u.user!.id,
        period_id: period.id,
        period_employee_id: pendingSel.emp.id,
        source_employee_id: pendingSel.emp.source_employee_id,
        label,
        start_date: pendingSel.start,
        end_date: pendingSel.end,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["custom-occ", period.id] });
      setPendingSel(null);
      toast.success("Ocorrência criada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateCustom = useMutation({
    mutationFn: async (label: string) => {
      if (!editCustom) return;
      const { error } = await supabase
        .from("custom_occurrences")
        .update({ label })
        .eq("id", editCustom.occ.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["custom-occ", period.id] });
      setEditCustom(null);
      toast.success("Ocorrência atualizada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteCustom = useMutation({
    mutationFn: async () => {
      if (!editCustom) return;
      const { error } = await supabase
        .from("custom_occurrences")
        .delete()
        .eq("id", editCustom.occ.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["custom-occ", period.id] });
      setEditCustom(null);
      toast.success("Ocorrência excluída");
    },
    onError: (e: Error) => toast.error(e.message),
  });

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

        <div className="overflow-auto sheet-scroll max-h-[calc(100vh-12rem)]">
          <table className="border-separate border-spacing-0 text-sm w-full">
            <thead className="sticky top-0 z-30">
              <tr>
                <th className="sticky left-0 top-0 z-40 bg-card border-b border-r min-w-[240px] text-left px-3 py-2 font-medium text-muted-foreground align-top">
                  <div className="space-y-1.5">
                    <div>Colaborador</div>
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <input
                        type="text"
                        value={search}
                        onChange={(e) => onSearchChange(e.target.value)}
                        placeholder="Pesquisar…"
                        className="w-full h-7 pl-7 pr-6 text-xs rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      {search && (
                        <button
                          onClick={() => onSearchChange("")}
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          aria-label="Limpar"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </th>
                {days.map((d, idx) => {
                  const f = fmtDay(d);
                  const pd = dayTypeMap.get(d);
                  const ds = dayState(d, today);
                  // Weekly banding: alternate subtle background per Mon-Sun week.
                  const wkKey = mondayKey(d);
                  const wkIndex = Array.from(
                    new Set(days.map((x) => mondayKey(x))),
                  ).indexOf(wkKey);
                  const isFirstOfWeek =
                    idx === 0 || mondayKey(days[idx - 1]) !== wkKey;
                  return (
                    <th
                      key={d}
                      className={cn(
                        "border-b border-r px-1 py-1.5 font-medium text-muted-foreground min-w-[64px] align-top transition-colors",
                        f.isWeekend ? "bg-muted/40" : "bg-card",
                        wkIndex % 2 === 1 && "bg-accent/10",
                        isFirstOfWeek && "border-l-2 border-l-primary/30",
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
                        periodStart={period.start_date}
                        periodEnd={period.end_date}
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
                          <Link
                            to="/colaboradores/$id"
                            params={{ id: emp.source_employee_id ?? emp.id }}
                            onClick={(e) => e.stopPropagation()}
                            className="font-medium truncate block hover:text-primary hover:underline underline-offset-2 decoration-primary/50"
                          >
                            {emp.name}
                          </Link>
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
                  {days.map((d, di) => {
                    const items = occMap.get(`${emp.id}|${d}`) ?? [];
                    const f = fmtDay(d);
                    const ds = dayState(d, today);
                    const dt = dayTypeMap.get(d)?.day_type ?? null;
                    const onVac = vacByEmp.get(emp.id)?.has(d) ?? false;
                    const seg = medSegByEmp.get(emp.id)?.get(d) ?? null;
                    const onMed = !!seg;
                    const segKey = seg ? `${emp.id}|${seg.id}` : null;
                    const segHover = !!segKey && hoverSeg === segKey;
                    const segStart = seg ? seg.start === d : false;
                    const segEnd = seg ? seg.end === d : false;
                    const cellSwap = swapByCell.get(`${emp.id}|${d}`) ?? null;
                    const swapDone =
                      !!cellSwap &&
                      cellSwap.swap.work_confirmed &&
                      cellSwap.swap.off_confirmed;
                    const customSeg = customSegByEmp.get(emp.id)?.get(d) ?? null;
                    const onCustom = !!customSeg;
                    const customSegKey = customSeg ? `${emp.id}|${customSeg.id}` : null;
                    const customSegHover = !!customSegKey && hoverCustom === customSegKey;
                    const customStart = customSeg ? customSeg.start === d : false;
                    const customEnd = customSeg ? customSeg.end === d : false;
                    const inSel =
                      !!sel &&
                      sel.empId === emp.id &&
                      di >= Math.min(sel.a, sel.b) &&
                      di <= Math.max(sel.a, sel.b);
                    const autoPresent =
                      !onVac &&
                      !onMed &&
                      !cellSwap &&
                      !onCustom &&
                      items.length === 0 &&
                      dt === "plantao" &&
                      (ds === "past" || ds === "today") &&
                      !emp.vacant;

                    const openCell = () => {
                      if (customSeg) {
                        const occ = customByCell.get(`${emp.id}|${d}`);
                        if (occ) setEditCustom({ occ, emp });
                        return;
                      }
                      const rows: CellOccurrence[] = [];
                      const ml = seg ? medById.get(seg.id) : null;
                      if (ml) {
                        rows.push({
                          recordId: ml.id,
                          type: "ATE",
                          arrival_time: null,
                          partner_name: null,
                          reason: null,
                          covered: null,
                          covered_by: null,
                          exit_time: null,
                          return_time: null,
                          note: ml.note ?? "",
                          start_date: ml.start_date,
                          days: ml.days,
                          cid: ml.cid,
                        });
                      }
                      if (cellSwap) {
                        const s = cellSwap.swap;
                        rows.push({
                          recordId: s.id,
                          type: "TC",
                          arrival_time: null,
                          partner_name: s.partner_name,
                          reason: null,
                          covered: null,
                          covered_by: null,
                          exit_time: null,
                          return_time: null,
                          note: s.note ?? "",
                          work_date: s.work_date,
                          off_date: s.off_date,
                          work_confirmed: s.work_confirmed,
                          off_confirmed: s.off_confirmed,
                        });
                      }
                      for (const i of items) {
                        rows.push({
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
                        });
                      }
                      setEditing({ employee: emp, date: d, rows });
                    };

                    return (
                      <td
                        key={d}
                        onMouseEnter={() => {
                          if (segKey) setHoverSeg(segKey);
                          if (customSegKey) setHoverCustom(customSegKey);
                          extendDrag(emp.id, di);
                        }}
                        onMouseLeave={() => {
                          segKey && setHoverSeg(null);
                          customSegKey && setHoverCustom(null);
                        }}
                        onMouseDown={(e) => {
                          if (e.button !== 0) return;
                          e.preventDefault();
                          startDrag(emp.id, di, openCell);
                        }}
                        className={cn(
                          "border-b border-r align-middle text-center transition select-none",
                          (onMed || onCustom) ? "p-0" : "p-1",
                          "cursor-pointer hover:bg-accent/40",
                          f.isWeekend && "bg-muted/20",
                          ds === "today" &&
                            "bg-primary/5 ring-1 ring-inset ring-primary/30",
                          ds === "future" && "opacity-60",
                          autoPresent && "bg-occ-p-bg/60",
                          onVac && "bg-occ-fer-bg/60",
                          onMed && !onVac && "bg-occ-ate-bg/50",
                          onMed && !segEnd && "border-r-transparent",
                          segHover && "bg-occ-ate-bg",
                          onCustom && !onMed && !onVac && "bg-muted/30",
                          onCustom && !onMed && !customEnd && "border-r-transparent",
                          customSegHover && "bg-muted/50",
                          cellSwap && !onVac && !onMed && !onCustom && "bg-occ-tc-bg/40",
                          inSel &&
                            "bg-primary/20 ring-1 ring-inset ring-primary/50 opacity-100",
                        )}
                      >
                        {customSeg ? (
                          <div
                            title={`${customSeg.label} — clique para editar`}
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation();
                              const occ = customByCell.get(`${emp.id}|${d}`);
                              if (occ) setEditCustom({ occ, emp });
                            }}
                            className={cn(
                              "relative min-h-[28px] w-full flex items-center gap-1 px-1 border-y border-border/70 bg-card transition-colors",
                              customStart && "rounded-l-md border-l pl-1.5",
                              customEnd && "rounded-r-md border-r",
                              customSegHover && "bg-muted",
                            )}
                          >
                            {customStart && (
                              <span className="absolute inset-y-0 left-1.5 z-10 flex items-center text-[10px] font-bold text-foreground whitespace-nowrap pointer-events-none">
                                {customSeg.label}
                              </span>
                            )}


                            <span className="flex-1 flex flex-wrap gap-0.5 justify-center">
                              {items.map((it) => {
                                const fm = faltaMeta(it);
                                const m = fm ?? OCC_META[it.type];
                                if (!m) return null;
                                return (
                                  <span
                                    key={it.id}
                                    title={`${m.full} — ${summaryFor(it)}`}
                                    className={cn(
                                      "inline-flex items-center justify-center px-1 rounded text-[10px] font-bold",
                                      m.bg,
                                      m.text,
                                    )}
                                  >
                                    {m.label}
                                  </span>
                                );
                              })}
                            </span>
                          </div>
                        ) : seg ? (
                          <div
                            title="Atestado — clique para ver o registro"
                            className={cn(
                              "min-h-[28px] flex items-center gap-1 px-1 border-y border-occ-ate/40 bg-occ-ate-bg transition-colors",
                              segStart && "rounded-l-md border-l pl-1.5",
                              segEnd && "rounded-r-md border-r",
                              segHover && "bg-occ-ate/25",
                            )}
                          >
                            {segStart && (
                              <span className="text-[10px] font-bold text-occ-ate whitespace-nowrap">
                                ATE
                              </span>
                            )}
                            <span className="flex-1 flex flex-wrap gap-0.5 justify-center">
                              {items.map((it) => {
                                const fm = faltaMeta(it);
                                const m = fm ?? OCC_META[it.type];
                                if (!m) return null;
                                return (
                                  <span
                                    key={it.id}
                                    title={`${m.full} — ${summaryFor(it)}`}
                                    className={cn(
                                      "inline-flex items-center justify-center px-1 rounded text-[10px] font-bold",
                                      m.bg,
                                      m.text,
                                    )}
                                  >
                                    {m.label}
                                  </span>
                                );
                              })}
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-0.5 justify-center min-h-[28px] items-center">
                            {onVac && (
                              <span
                                title="Férias"
                                className="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-occ-fer-bg text-occ-fer"
                              >
                                FER
                              </span>
                            )}
                            {cellSwap && (
                              <span
                                title={`Troca casada — dia de ${cellSwap.leg === "work" ? "trabalho" : "folga"} · ${swapDone ? "concluída" : "pendente"}`}
                                className={cn(
                                  "inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[10px] font-bold",
                                  swapDone
                                    ? "bg-occ-p-bg text-occ-p ring-1 ring-occ-p/30"
                                    : "bg-occ-a-bg text-occ-a ring-1 ring-occ-a/40",
                                )}
                              >
                                {swapDone ? (
                                  <CheckCircle2 className="h-2.5 w-2.5" />
                                ) : (
                                  <Clock className="h-2.5 w-2.5" />
                                )}
                                TC{cellSwap.leg === "work" ? "↑" : "↓"}
                              </span>
                            )}
                            {items.length === 0 && !onVac && !cellSwap && !onCustom ? (
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
                              const fm = faltaMeta(it);
                              const m = fm ?? OCC_META[it.type];
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
                        )}
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
          dayType={dayTypeMap.get(editing.date)?.day_type ?? null}
          initial={editing.rows}
          onSave={async (r) => saveCell.mutateAsync(r)}
        />
      )}

      <EmployeeEditDialog
        employee={editingEmp}
        period={period}
        open={!!editingEmp}
        onOpenChange={(o) => !o && setEditingEmp(null)}
      />


      {pendingSel && (
        <CustomOccurrenceDialog
          open={!!pendingSel}
          onOpenChange={(o) => !o && setPendingSel(null)}
          employeeName={pendingSel.emp.vacant ? "VAGO" : pendingSel.emp.name}
          start={pendingSel.start}
          end={pendingSel.end}
          saving={createCustom.isPending}
          onSave={(label) => createCustom.mutate(label)}
        />
      )}

      {editCustom && (
        <CustomOccurrenceDialog
          open={!!editCustom}
          onOpenChange={(o) => !o && setEditCustom(null)}
          employeeName={editCustom.emp.vacant ? "VAGO" : editCustom.emp.name}
          start={editCustom.occ.start_date}
          end={editCustom.occ.end_date}
          initialLabel={editCustom.occ.label}
          saving={updateCustom.isPending || deleteCustom.isPending}
          onSave={(label) => updateCustom.mutate(label)}
          onDelete={() => deleteCustom.mutate()}
        />
      )}
    </>

  );
}
