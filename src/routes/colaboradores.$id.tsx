import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarDays,
  AlertCircle,
  Plane,
  ArrowLeftRight,
  Clock,
  LogOut as LogOutIcon,
  Plus,
  ShieldAlert,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { isAtestado, faltaMeta, summaryFor, eachDay, type OccType } from "@/lib/occurrence";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/colaboradores/$id")({
  component: ProfilePage,
  head: ({ params }) => ({
    meta: [
      { title: `Perfil — Controle de Folha` },
      { name: "description", content: `Perfil do colaborador ${params.id}` },
    ],
  }),
});

type Occ = {
  id: string;
  date: string;
  type: OccType;
  reason: string | null;
  arrival_time: string | null;
  partner_name: string | null;
  covered: boolean | null;
  covered_by: string | null;
  exit_time: string | null;
  return_time: string | null;
  note: string | null;
  sanction_kind: string | null;
  suspension_days: number | null;
};

function todayMinusMonths(m: number) {
  const d = new Date();
  d.setMonth(d.getMonth() - m);
  return d.toISOString().slice(0, 10);
}
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function ProfilePage() {
  const navigate = useNavigate();
  const { id } = Route.useParams();
  const [from, setFrom] = useState(todayMinusMonths(6));
  const [to, setTo] = useState(todayISO());

  // Fetch every period_employee row tied to this "source" key. Since the
  // first periods may pre-date the source_employee_id system, treat the
  // route id as either a source_employee_id or a period_employees.id.
  const { data: peRows = [] } = useQuery({
    queryKey: ["profile-pe", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("period_employees")
        .select("id,name,role,vacant,source_employee_id,period_id")
        .or(`source_employee_id.eq.${id},id.eq.${id}`);
      if (error) throw error;
      return data ?? [];
    },
  });

  const peIds = useMemo(() => peRows.map((r) => r.id), [peRows]);
  const current = useMemo(() => peRows[0], [peRows]);

  const { data: occs = [] } = useQuery({
    queryKey: ["profile-occs", id, peIds.length, from, to],
    enabled: peIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("occurrences")
        .select(
          "id,date,type,reason,arrival_time,partner_name,covered,covered_by,exit_time,return_time,note,sanction_kind,suspension_days",
        )
        .in("employee_id", peIds)
        .gte("date", from)
        .lte("date", to)
        .order("date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Occ[];
    },
  });

  const { data: vacations = [] } = useQuery({
    queryKey: ["profile-vac", id, peIds.length],
    enabled: peIds.length > 0,
    queryFn: async () => {
      const filters: string[] = [];
      filters.push(`source_employee_id.eq.${id}`);
      if (peIds.length) filters.push(`period_employee_id.in.(${peIds.join(",")})`);
      const { data, error } = await supabase
        .from("employee_vacations")
        .select("id,start_date,end_date,created_at")
        .or(filters.join(","));
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: medLeaves = [] } = useQuery({
    queryKey: ["profile-medleaves", id, peIds.length],
    enabled: peIds.length > 0,
    queryFn: async () => {
      const filters: string[] = [];
      filters.push(`source_employee_id.eq.${id}`);
      if (peIds.length) filters.push(`period_employee_id.in.(${peIds.join(",")})`);
      const { data, error } = await supabase
        .from("employee_medical_leaves")
        .select("id,start_date,end_date,days,cid,note,created_at")
        .or(filters.join(","));
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: swaps = [] } = useQuery({
    queryKey: ["profile-swaps", id, peIds.length],
    enabled: peIds.length > 0,
    queryFn: async () => {
      const filters: string[] = [];
      filters.push(`source_employee_id.eq.${id}`);
      if (peIds.length) filters.push(`period_employee_id.in.(${peIds.join(",")})`);
      const { data, error } = await supabase
        .from("employee_swaps")
        .select(
          "id,work_date,off_date,work_confirmed,off_confirmed,canceled,note,partner_period_employee_id",
        )
        .or(filters.join(","))
        .order("work_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });


  const { data: history = [] } = useQuery({
    queryKey: ["profile-history", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_role_history")
        .select("id,from_role,to_role,changed_at,note")
        .eq("source_employee_id", id)
        .order("changed_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Counters by type, with Atestado split out from common Falta.
  const counters = useMemo(() => {
    const c = { A: 0, TC: 0, F: 0, ATE: 0, SA: 0, SD: 0, EX: 0, FER: 0 };
    const ateDays = new Set<string>();
    for (const o of occs) {
      if (o.type === "F" && isAtestado(o)) {
        ateDays.add(o.date);
      } else {
        c[o.type]++;
      }
    }
    for (const ml of medLeaves) {
      for (const d of eachDay(ml.start_date, ml.end_date)) {
        if (d >= from && d <= to) ateDays.add(d);
      }
    }
    c.ATE = ateDays.size;
    c.FER = vacations.length;
    return c;
  }, [occs, vacations, medLeaves, from, to]);

  const chartData = useMemo(
    () => [
      { name: "Faltas", value: counters.F, fill: "var(--occ-f)" },
      { name: "Atestados", value: counters.ATE, fill: "var(--occ-ate)" },
      { name: "Atrasos", value: counters.A, fill: "var(--occ-a)" },
      { name: "Saídas ant.", value: counters.SA, fill: "var(--occ-sa)" },
      { name: "Extras", value: counters.EX, fill: "var(--occ-ex)" },
      { name: "Sanções", value: counters.SD, fill: "var(--occ-sd)" },
      { name: "Troca cas.", value: counters.TC, fill: "var(--occ-tc)" },
      { name: "Férias", value: counters.FER, fill: "var(--occ-fer)" },
    ],
    [counters],
  );

  const sanctions = useMemo(() => occs.filter((o) => o.type === "SD"), [occs]);

  if (!current) {
    return (
      <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">
        Colaborador não encontrado.
        <Button variant="link" onClick={() => navigate({ to: "/" })}>
          Voltar
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card/40 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 py-5">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-3"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar à folha
          </Link>
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {current.vacant ? "VAGO" : current.name}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {current.role ?? "Sem cargo definido"}
              </p>
            </div>
            <div className="flex items-end gap-2">
              <div className="space-y-1">
                <Label className="text-[10px] uppercase">De</Label>
                <Input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="h-9 w-[140px]"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase">Até</Label>
                <Input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="h-9 w-[140px]"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6">
        <Tabs defaultValue="analise">
          <TabsList>
            <TabsTrigger value="analise">Análise</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
            <TabsTrigger value="cargos">Mudanças de cargo</TabsTrigger>
          </TabsList>

          <TabsContent value="analise" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Kpi icon={AlertCircle} label="Faltas" value={counters.F} tint="occ-f" />
              <Kpi icon={Plus} label="Atestados" value={counters.ATE} tint="occ-ate" />
              <Kpi icon={Clock} label="Atrasos" value={counters.A} tint="occ-a" />
              <Kpi icon={LogOutIcon} label="Saídas ant." value={counters.SA} tint="occ-sa" />
              <Kpi icon={CalendarDays} label="Extras" value={counters.EX} tint="occ-ex" />
              <Kpi icon={ShieldAlert} label="Sanções" value={counters.SD} tint="occ-sd" />
              <Kpi icon={ArrowLeftRight} label="Troca casada" value={counters.TC} tint="occ-tc" />
              <Kpi icon={Plane} label="Férias" value={counters.FER} tint="occ-fer" />
            </div>
            <Card className="p-4">
              <h3 className="text-sm font-semibold mb-3">Distribuição por tipo</h3>
              <div className="h-72">
                <ResponsiveContainer>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        background: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: 6,
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="historico" className="space-y-6 mt-4">
            <Section title={`Sanções disciplinares (${sanctions.length})`}>
              {sanctions.length === 0 ? (
                <Empty>Nenhuma sanção no período.</Empty>
              ) : (
                <ul className="divide-y rounded-lg border bg-card">
                  {sanctions.map((s) => (
                    <li key={s.id} className="px-3 py-2 text-sm flex items-center gap-3">
                      <span className="text-xs tabular-nums text-muted-foreground w-24">
                        {s.date}
                      </span>
                      <span className="font-medium">
                        {s.sanction_kind ?? "Sanção"}
                      </span>
                      {s.suspension_days ? (
                        <span className="text-xs text-muted-foreground">
                          · {s.suspension_days} dias
                        </span>
                      ) : null}
                      {s.note && (
                        <span className="text-xs text-muted-foreground truncate">— {s.note}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title={`Ocorrências (${occs.length})`}>
              {occs.length === 0 ? (
                <Empty>Sem ocorrências no período.</Empty>
              ) : (
                <ul className="divide-y rounded-lg border bg-card max-h-96 overflow-y-auto sheet-scroll">
                  {occs.map((o) => {
                    const fm = faltaMeta(o);
                    return (
                      <li key={o.id} className="px-3 py-2 text-sm flex items-center gap-3">
                        <span className="text-xs tabular-nums text-muted-foreground w-24">
                          {o.date}
                        </span>
                        <span
                          className={cn(
                            "inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-bold",
                            fm ? `${fm.bg} ${fm.text}` : `bg-occ-${o.type.toLowerCase()}-bg text-occ-${o.type.toLowerCase()}`,
                          )}
                        >
                          {fm ? fm.label : o.type}
                        </span>
                        <span className="text-xs text-muted-foreground truncate">
                          {summaryFor(o)}
                          {o.note ? ` — ${o.note}` : ""}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Section>

            <Section title={`Férias (${vacations.length})`}>
              {vacations.length === 0 ? (
                <Empty>Sem férias registradas.</Empty>
              ) : (
                <ul className="divide-y rounded-lg border bg-card">
                  {vacations.map((v) => (
                    <li key={v.id} className="px-3 py-2 text-sm flex items-center gap-3">
                      <Plane className="h-3.5 w-3.5 text-occ-fer" />
                      <span className="tabular-nums">
                        {v.start_date} → {v.end_date}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title={`Atestados por intervalo (${medLeaves.length})`}>
              {medLeaves.length === 0 ? (
                <Empty>Sem atestados por intervalo registrados.</Empty>
              ) : (
                <ul className="divide-y rounded-lg border bg-card">
                  {medLeaves.map((m) => (
                    <li key={m.id} className="px-3 py-2 text-sm flex items-center gap-3">
                      <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-occ-ate-bg text-occ-ate">
                        ATE
                      </span>
                      <span className="tabular-nums">
                        {m.start_date} → {m.end_date}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {m.days} dia{m.days === 1 ? "" : "s"}
                      </span>
                      {m.cid && (
                        <span className="text-xs text-muted-foreground">· CID {m.cid}</span>
                      )}
                      {m.note && (
                        <span className="text-xs text-muted-foreground truncate">— {m.note}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title={`Trocas casadas (${swaps.length})`}>
              {swaps.length === 0 ? (
                <Empty>Sem trocas casadas registradas.</Empty>
              ) : (
                <ul className="divide-y rounded-lg border bg-card">
                  {swaps.map((s) => {
                    const status = s.canceled
                      ? "Cancelada"
                      : s.work_confirmed && s.off_confirmed
                        ? "Confirmada"
                        : "Agendada/Pendente";
                    return (
                      <li key={s.id} className="px-3 py-2 text-sm flex items-center gap-3">
                        <ArrowLeftRight className="h-3.5 w-3.5 text-occ-tc" />
                        <span className="tabular-nums">
                          Trab {s.work_date} → Folga {s.off_date}
                        </span>
                        <span className="text-xs text-muted-foreground">· {status}</span>
                        {s.note && (
                          <span className="text-xs text-muted-foreground truncate">— {s.note}</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Section>
          </TabsContent>


          <TabsContent value="cargos" className="mt-4">
            {history.length === 0 ? (
              <Empty>Nenhuma mudança de cargo registrada.</Empty>
            ) : (
              <ol className="relative border-l ml-3 space-y-4">
                {history.map((h) => (
                  <li key={h.id} className="ml-4">
                    <span className="absolute -left-1.5 h-3 w-3 rounded-full bg-primary" />
                    <div className="text-sm">
                      <span className="font-medium">{h.from_role ?? "—"}</span>{" "}
                      <span className="text-muted-foreground">→</span>{" "}
                      <span className="font-medium">{h.to_role}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(h.changed_at).toLocaleString("pt-BR")}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  tint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tint: string;
}) {
  return (
    <Card className="p-3 flex items-center gap-3">
      <div className={cn("grid place-items-center h-9 w-9 rounded-lg", `bg-${tint}-bg`)}>
        <Icon className={cn("h-4 w-4", `text-${tint}`)} />
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="text-xl font-bold tabular-nums">{value}</div>
      </div>
    </Card>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-sm font-semibold mb-2">{title}</h3>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-6 text-center text-xs text-muted-foreground">
      {children}
    </div>
  );
}
