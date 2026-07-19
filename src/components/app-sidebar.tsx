import { useEffect, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  ClipboardList,
  CalendarDays,
  BarChart3,
  Users,
  Settings as SettingsIcon,
  LogOut,
  Calendar,
  Pencil,
  Trash2,
  PanelLeftOpen,
  PanelLeftClose,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { SettingsDialog } from "./settings-dialog";
import { NewPeriodDialog } from "./new-period-dialog";
import type { Period } from "./period-sidebar";

const EXPAND_KEY = "cf-sidebar-expanded";

export function AppSidebar({
  selectedPeriodId,
  onSelectPeriod,
}: {
  selectedPeriodId: string | null;
  onSelectPeriod: (p: Period) => void;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const path = useRouterState({ select: (r) => r.location.pathname });

  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    setExpanded(localStorage.getItem(EXPAND_KEY) === "1");
  }, []);

  function toggle() {
    setExpanded((prev) => {
      const next = !prev;
      localStorage.setItem(EXPAND_KEY, next ? "1" : "0");
      return next;
    });
  }

  const [settingsOpen, setSettingsOpen] = useState(false);

  const [editing, setEditing] = useState<Period | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [eStart, setEStart] = useState("");
  const [eEnd, setEEnd] = useState("");
  const [eLabel, setELabel] = useState("");

  const { data: periods = [] } = useQuery({
    queryKey: ["periods"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("periods")
        .select("id,label,start_date,end_date")
        .order("start_date", { ascending: false });
      if (error) throw error;
      if (data && data.length && !selectedPeriodId) onSelectPeriod(data[0] as Period);
      return (data ?? []) as Period[];
    },
  });

  useEffect(() => {
    if (!selectedPeriodId) return;
    const p = periods.find((x) => x.id === selectedPeriodId);
    if (p) onSelectPeriod(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periods]);

  const updatePeriod = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const { error } = await supabase
        .from("periods")
        .update({ label: eLabel, start_date: eStart, end_date: eEnd })
        .eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["periods"] });
      setEditOpen(false);
      toast.success("Período atualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removePeriod = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("periods").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["periods"] }),
  });

  function openEdit(p: Period) {
    setEditing(p);
    setEStart(p.start_date);
    setEEnd(p.end_date);
    setELabel(p.label);
    setEditOpen(true);
  }

  const NavItem = ({
    to,
    icon: Icon,
    label,
    active,
    onClick,
  }: {
    to?: string;
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    active?: boolean;
    onClick?: () => void;
  }) => {
    const inner = (
      <>
        <Icon className="h-4 w-4 shrink-0" />
        <span
          className={cn(
            "text-sm font-medium whitespace-nowrap overflow-hidden transition-all",
            expanded ? "opacity-100 w-auto" : "opacity-0 w-0",
          )}
        >
          {label}
        </span>
      </>
    );
    const cls = cn(
      "flex items-center gap-3 rounded-md px-3 py-2 mx-2 transition",
      active
        ? "bg-sidebar-accent text-sidebar-accent-foreground"
        : "text-sidebar-foreground/85 hover:bg-sidebar-accent/60",
    );
    if (onClick) {
      return (
        <button onClick={onClick} className={cn(cls, "w-[calc(100%-1rem)] text-left")} title={label}>
          {inner}
        </button>
      );
    }
    return (
      <Link to={to!} className={cls} title={label}>
        {inner}
      </Link>
    );
  };

  return (
    <>
      <aside
        className={cn(
          "shrink-0 bg-sidebar text-sidebar-foreground flex flex-col h-screen sticky top-0 z-30 border-r border-sidebar-border",
          "transition-[width] duration-300 ease-out",
          expanded ? "w-64" : "w-14",
        )}
      >
        <div className="h-14 flex items-center gap-2 px-3 border-b border-sidebar-border">
          <button
            onClick={toggle}
            className="grid place-items-center w-8 h-8 rounded-md bg-sidebar-primary text-sidebar-primary-foreground shrink-0 hover:opacity-90 transition"
            title={expanded ? "Recolher" : "Expandir"}
            aria-label={expanded ? "Recolher menu" : "Expandir menu"}
          >
            {expanded ? (
              <PanelLeftClose className="h-4 w-4" />
            ) : (
              <PanelLeftOpen className="h-4 w-4" />
            )}
          </button>
          <div
            className={cn(
              "leading-tight overflow-hidden transition-all",
              expanded ? "opacity-100 w-auto" : "opacity-0 w-0",
            )}
          >
            <p className="text-sm font-semibold whitespace-nowrap">Controle de Folha</p>
          </div>
          {expanded && (
            <span className="ml-auto opacity-0 pointer-events-none">
              <ClipboardList className="h-4 w-4" />
            </span>
          )}
        </div>

        <div className="py-2 space-y-0.5">
          <NavItem to="/" icon={CalendarDays} label="Folha" active={path === "/"} />
          <NavItem to="/analise" icon={BarChart3} label="Análise" active={path === "/analise"} />
        </div>

        <div className="px-2 mt-2 mb-1">
          <span
            className={cn(
              "text-[10px] uppercase tracking-wider text-sidebar-foreground/50 px-1 transition-opacity",
              expanded ? "opacity-100" : "opacity-0",
            )}
          >
            Períodos
          </span>
        </div>

        {expanded && (
          <div className="px-2">
            <NewPeriodDialog onCreated={(p) => onSelectPeriod(p)} />
          </div>
        )}

        <nav className="flex-1 overflow-y-auto px-2 pt-2 pb-3 space-y-0.5 sheet-scroll">
          {expanded ? (
            periods.map((p) => (
              <div
                key={p.id}
                className={cn(
                  "group flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer text-xs",
                  selectedPeriodId === p.id
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "hover:bg-sidebar-accent/60 text-sidebar-foreground/85",
                )}
                onClick={() => {
                  onSelectPeriod(p);
                  if (path !== "/") navigate({ to: "/" });
                }}
              >
                <Calendar className="h-3.5 w-3.5 opacity-70 shrink-0" />
                <span className="flex-1 truncate">{p.label}</span>
                <button
                  className="opacity-0 group-hover:opacity-70 hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    openEdit(p);
                  }}
                  aria-label="Editar"
                >
                  <Pencil className="h-3 w-3" />
                </button>
                <button
                  className="opacity-0 group-hover:opacity-70 hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm("Remover este período e suas ocorrências?"))
                      removePeriod.mutate(p.id);
                  }}
                  aria-label="Remover"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))
          ) : (
            <div className="text-center py-1">
              <Calendar className="h-4 w-4 opacity-40 mx-auto" />
            </div>
          )}
        </nav>

        <div className="border-t border-sidebar-border py-2 space-y-0.5">
          <NavItem
            icon={SettingsIcon}
            label="Configurações"
            onClick={() => setSettingsOpen(true)}
          />
          <NavItem
            icon={LogOut}
            label="Sair"
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/auth" });
            }}
          />
        </div>
      </aside>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar período</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground -mt-2">
            As ocorrências e os colaboradores deste período são preservados.
          </p>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Rótulo</Label>
              <Input value={eLabel} onChange={(e) => setELabel(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Início</Label>
                <Input type="date" value={eStart} onChange={(e) => setEStart(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Fim</Label>
                <Input type="date" value={eEnd} onChange={(e) => setEEnd(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => updatePeriod.mutate()} disabled={updatePeriod.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}
