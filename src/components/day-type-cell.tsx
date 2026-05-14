import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type DayType = "plantao" | "folga" | null;

const META: Record<NonNullable<DayType>, { label: string; cls: string }> = {
  plantao: { label: "Plantão", cls: "bg-day-plantao-bg text-day-plantao" },
  folga: { label: "Folga", cls: "bg-day-folga-bg text-day-folga" },
};

export function DayTypeCell({
  periodId,
  date,
  current,
  existingId,
}: {
  periodId: string;
  date: string;
  current: DayType;
  existingId?: string;
}) {
  const qc = useQueryClient();

  const setType = useMutation({
    mutationFn: async (next: DayType) => {
      const { data: u } = await supabase.auth.getUser();
      if (next === null) {
        if (existingId) {
          const { error } = await supabase.from("period_days").delete().eq("id", existingId);
          if (error) throw error;
        }
        return;
      }
      if (existingId) {
        const { error } = await supabase
          .from("period_days")
          .update({ day_type: next })
          .eq("id", existingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("period_days").insert({
          user_id: u.user!.id,
          period_id: periodId,
          date,
          day_type: next,
        });
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
          title="Definir tipo do dia"
        >
          {meta ? meta.label : "—"}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-36 p-1" align="center">
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
