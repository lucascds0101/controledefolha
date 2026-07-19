import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { expandScheduleFromAnchor, type SlotType } from "@/lib/schedule";

export type DayType = "plantao" | "folga" | null;

const META: Record<NonNullable<DayType>, { label: string; cls: string }> = {
  plantao: { label: "Plantão", cls: "bg-day-plantao-bg text-day-plantao" },
  folga: { label: "Folga", cls: "bg-day-folga-bg text-day-folga" },
};

export function DayTypeCell({
  periodId,
  periodStart,
  periodEnd,
  date,
  current,
  existingId,
}: {
  periodId: string;
  periodStart: string;
  periodEnd: string;
  date: string;
  current: DayType;
  existingId?: string;
}) {
  const qc = useQueryClient();

  const setType = useMutation({
    mutationFn: async (next: DayType) => {
      const { data: u } = await supabase.auth.getUser();
      const userId = u.user!.id;

      // Clear: remove this manual mark only.
      if (next === null) {
        if (existingId) {
          const { error } = await supabase.from("period_days").delete().eq("id", existingId);
          if (error) throw error;
        }
        return;
      }

      // Persist this day (never as a locked anchor — every edit is recomputable).
      if (existingId) {
        const { error } = await supabase
          .from("period_days")
          .update({ day_type: next, manual: false })
          .eq("id", existingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("period_days").insert({
          user_id: userId,
          period_id: periodId,
          date,
          day_type: next,
          manual: false,
        });
        if (error) throw error;
      }

      // Auto-infer the rest of the period from this anchor.
      const map = expandScheduleFromAnchor(periodStart, periodEnd, date, next as SlotType);
      if (!map) return;

      // Load existing rows once and respect manual edits other than this one.
      const { data: existing, error: exErr } = await supabase
        .from("period_days")
        .select("id,date,day_type,manual")
        .eq("period_id", periodId);
      if (exErr) throw exErr;
      const byDate = new Map<string, { id: string; day_type: string; manual: boolean }>();
      for (const r of existing ?? []) byDate.set(r.date as string, r as any);

      const toInsert: { user_id: string; period_id: string; date: string; day_type: SlotType; manual: boolean }[] = [];
      const toUpdate: { id: string; day_type: SlotType }[] = [];

      for (const [d, dt] of map.entries()) {
        if (d === date) continue; // skip the anchor itself
        const row = byDate.get(d);
        if (!row) {
          toInsert.push({ user_id: userId, period_id: periodId, date: d, day_type: dt, manual: false });
        } else if (!row.manual && row.day_type !== dt) {
          toUpdate.push({ id: row.id, day_type: dt });
        }
      }

      if (toInsert.length) {
        const { error } = await supabase.from("period_days").insert(toInsert);
        if (error) throw error;
      }
      for (const u of toUpdate) {
        const { error } = await supabase
          .from("period_days")
          .update({ day_type: u.day_type })
          .eq("id", u.id);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["period_days", periodId] }),
  });

  const meta = current ? META[current] : null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "block w-full text-[9px] font-bold uppercase tracking-wide rounded px-1 py-0.5 mt-0.5 transition",
            meta ? meta.cls : "text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted",
          )}
          title="Definir tipo do dia (a escala será inferida automaticamente)"
        >
          {meta ? meta.label : "—"}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-44 p-1" align="center">
        {(["plantao", "folga"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setType.mutate(t)}
            className={cn(
              "w-full text-left text-xs px-2 py-1.5 rounded hover:bg-accent transition",
              current === t && "bg-accent font-semibold",
            )}
          >
            {META[t].label}
          </button>
        ))}
        <button
          onClick={() => setType.mutate(null)}
          className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-accent text-muted-foreground"
        >
          Limpar
        </button>
      </PopoverContent>
    </Popover>
  );
}
