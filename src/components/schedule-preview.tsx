import { SCALES, WEEKDAY_SHORT, type WeekScale } from "@/lib/schedule";
import { cn } from "@/lib/utils";

export function SchedulePreview({ scale }: { scale: WeekScale }) {
  const days = SCALES[scale];
  return (
    <div className="rounded-md border bg-card overflow-hidden">
      <div className="grid grid-cols-7">
        {WEEKDAY_SHORT.map((wd, i) => {
          const t = days[i];
          const isP = t === "plantao";
          return (
            <div
              key={wd}
              className={cn(
                "flex flex-col items-center py-2 border-r last:border-r-0",
                isP
                  ? "bg-day-plantao-bg text-day-plantao"
                  : "bg-day-folga-bg text-day-folga",
              )}
            >
              <span className="text-[10px] uppercase tracking-wider opacity-70">
                {wd}
              </span>
              <span className="mt-1 text-[10px] font-bold uppercase">
                {isP ? "Plantão" : "Folga"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
