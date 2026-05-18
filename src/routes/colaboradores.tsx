import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Users, UserPlus, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppSidebar } from "@/components/app-sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Period } from "@/components/period-sidebar";
import { cn } from "@/lib/utils";
import { todayISO } from "@/lib/date-utils";
import { toast } from "sonner";

export const Route = createFileRoute("/colaboradores")({
  component: ColaboradoresPage,
  head: () => ({
    meta: [
      { title: "Colaboradores — Controle de Folha" },
      {
        name: "description",
        content: "Gerencie o quadro de colaboradores em formato Kanban por cargo.",
      },
    ],
  }),
});

const ROLES = [
  "Supervisão",
  "Coordenação",
  "Backoffice",
  "PA",
  "Operador de comunicação",
  "Operador de monitoramento",
] as const;
type RoleName = (typeof ROLES)[number];

type EmpRow = {
  id: string;
  source_employee_id: string | null;
  name: string;
  role: string | null;
  vacant: boolean;
  period_end: string;
};

type UniqueEmp = {
  key: string; // source_employee_id or period_employees.id fallback
  name: string;
  role: string | null;
  vacant: boolean;
  ids: string[]; // all period_employees rows for current+future periods
};

function ColaboradoresPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [period, setPeriod] = useState<Period | null>(null);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!s) navigate({ to: "/auth" });
    });
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) navigate({ to: "/auth" });
      else setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  if (!ready) {
    return (
      <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">
        Carregando…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar selectedPeriodId={period?.id ?? null} onSelectPeriod={setPeriod} />
      <main className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-10 bg-background/80 backdrop-blur border-b">
          <div className="px-6 py-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="grid place-items-center h-9 w-9 rounded-lg bg-primary/10 text-primary">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-lg font-semibold tracking-tight">Colaboradores</h1>
                <p className="text-xs text-muted-foreground">
                  Arraste os cards entre as colunas para reorganizar o cargo
                </p>
              </div>
            </div>
            <NewEmployeeButton />
          </div>
        </header>

        <div className="p-6">
          <Kanban />
        </div>
      </main>
    </div>
  );
}

function useEmployeesGrouped() {
  const today = todayISO();
  return useQuery({
    queryKey: ["kanban-employees", today],
    queryFn: async (): Promise<UniqueEmp[]> => {
      // Pull every period_employee on a current/future period so role changes
      // here propagate forward.
      const { data: peRows, error } = await supabase
        .from("period_employees")
        .select("id,source_employee_id,name,role,vacant,periods!inner(end_date)")
        .gte("periods.end_date", today);
      if (error) throw error;

      const list = (peRows ?? []) as unknown as Array<{
        id: string;
        source_employee_id: string | null;
        name: string;
        role: string | null;
        vacant: boolean;
        periods: { end_date: string };
      }>;

      const groups = new Map<string, UniqueEmp>();
      for (const r of list) {
        const key = r.source_employee_id ?? r.id;
        let g = groups.get(key);
        if (!g) {
          g = { key, name: r.name, role: r.role, vacant: r.vacant, ids: [] };
          groups.set(key, g);
        }
        g.ids.push(r.id);
        // Prefer the latest name/role from the rows we see
        g.name = r.name;
        g.role = r.role;
        g.vacant = r.vacant;
      }
      return Array.from(groups.values());
    },
  });
}

function Kanban() {
  const qc = useQueryClient();
  const { data: groups = [], isLoading } = useEmployeesGrouped();
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const columns = useMemo(() => {
    const cols = new Map<string, UniqueEmp[]>();
    for (const r of ROLES) cols.set(r, []);
    cols.set("__sem__", []);
    for (const g of groups) {
      const role = g.role && ROLES.includes(g.role as RoleName) ? g.role : "__sem__";
      cols.get(role)!.push(g);
    }
    for (const arr of cols.values()) {
      arr.sort((a, b) =>
        (a.vacant ? "ZZZ" : a.name).localeCompare(b.vacant ? "ZZZ" : b.name, "pt-BR", {
          sensitivity: "base",
        }),
      );
    }
    return cols;
  }, [groups]);

  const move = useMutation({
    mutationFn: async ({ group, toRole }: { group: UniqueEmp; toRole: string }) => {
      const { data: u } = await supabase.auth.getUser();
      const fromRole = group.role;
      // Update every current/future period_employees row for this collaborator
      const { error: upErr } = await supabase
        .from("period_employees")
        .update({ role: toRole })
        .in("id", group.ids);
      if (upErr) throw upErr;
      // Audit
      await supabase.from("employee_role_history").insert({
        user_id: u.user!.id,
        source_employee_id: group.key,
        employee_name: group.name,
        from_role: fromRole,
        to_role: toRole,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kanban-employees"] });
      qc.invalidateQueries({ queryKey: ["period_employees"] });
      toast.success("Cargo atualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function onDragStart(e: DragStartEvent) {
    setActiveKey(String(e.active.id));
  }
  function onDragEnd(e: DragEndEvent) {
    setActiveKey(null);
    if (!e.over) return;
    const key = String(e.active.id);
    const group = groups.find((g) => g.key === key);
    const toRole = String(e.over.id);
    if (!group || group.role === toRole) return;
    move.mutate({ group, toRole });
  }

  const active = activeKey ? groups.find((g) => g.key === activeKey) : null;

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Carregando colaboradores…</div>;
  }

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 min-h-[60vh]">
        {ROLES.map((r) => (
          <Column key={r} role={r} items={columns.get(r) ?? []} />
        ))}
      </div>
      {(columns.get("__sem__") ?? []).length > 0 && (
        <div className="mt-6">
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
            Sem cargo definido
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {(columns.get("__sem__") ?? []).map((g) => (
              <Card key={g.key} group={g} />
            ))}
          </div>
        </div>
      )}
      <DragOverlay>
        {active ? (
          <div className="rotate-2 shadow-2xl">
            <Card group={active} dragging />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function Column({ role, items }: { role: RoleName; items: UniqueEmp[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: role });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col rounded-xl border bg-card transition-colors min-h-[200px]",
        isOver && "ring-2 ring-primary/50 bg-accent/30",
      )}
    >
      <div className="px-3 py-2 border-b sticky top-0 bg-card rounded-t-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">{role}</h3>
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {items.length}
          </span>
        </div>
      </div>
      <div className="p-2 space-y-2 flex-1">
        <AnimatePresence mode="popLayout" initial={false}>
          {items.map((g) => (
            <motion.div
              key={g.key}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
            >
              <Card group={g} />
            </motion.div>
          ))}
        </AnimatePresence>
        {items.length === 0 && (
          <div className="text-[11px] text-muted-foreground/70 text-center py-6">
            Solte aqui
          </div>
        )}
      </div>
    </div>
  );
}

function Card({ group, dragging }: { group: UniqueEmp; dragging?: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: group.key });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn(
        "group rounded-lg border bg-background p-2.5 cursor-grab active:cursor-grabbing hover:border-primary/50 transition",
        (isDragging || dragging) && "opacity-50",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {group.vacant ? (
            <div className="font-bold tracking-wider text-muted-foreground text-sm">VAGO</div>
          ) : (
            <div className="font-medium text-sm truncate">{group.name}</div>
          )}
          <div className="mt-1 flex items-center gap-1.5">
            <span
              className={cn(
                "inline-block h-1.5 w-1.5 rounded-full",
                group.vacant ? "bg-muted-foreground/50" : "bg-occ-p",
              )}
            />
            <span className="text-[10px] text-muted-foreground">
              {group.vacant ? "Vago" : "Ativo"}
            </span>
          </div>
        </div>
        <Link
          to="/colaboradores/$id"
          params={{ id: group.key }}
          onPointerDown={(e) => e.stopPropagation()}
          className="opacity-0 group-hover:opacity-100 transition text-muted-foreground hover:text-foreground"
          title="Abrir perfil"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}

function NewEmployeeButton() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState<string>("");

  const create = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const userId = u.user!.id;
      // Find the latest period and add this person to it (so they show up
      // immediately in the kanban via the current+future period_employees join).
      const { data: periods } = await supabase
        .from("periods")
        .select("id")
        .order("start_date", { ascending: false })
        .limit(1);
      if (!periods?.length) throw new Error("Crie um período antes de adicionar colaboradores.");
      const { error } = await supabase.from("period_employees").insert({
        user_id: userId,
        period_id: periods[0].id,
        name,
        role: role || null,
        position: 999,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kanban-employees"] });
      qc.invalidateQueries({ queryKey: ["period_employees"] });
      setOpen(false);
      setName("");
      setRole("");
      toast.success("Colaborador adicionado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
            <Label>Cargo</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione…" />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => create.mutate()} disabled={!name.trim() || create.isPending}>
            Adicionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
