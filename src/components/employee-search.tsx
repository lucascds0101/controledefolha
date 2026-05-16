import { useState } from "react";
import { Search, X, ChevronsUpDown, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export type SearchOption = {
  id: string;
  name: string;
  role: string | null;
  vacant: boolean;
};

/**
 * Hybrid input + dropdown search.
 * Selecting an option sets the text to that option's display name.
 * Typing in the input acts as a free text filter.
 */
export function EmployeeSearch({
  value,
  onChange,
  options,
  placeholder = "Pesquisar colaborador…",
}: {
  value: string;
  onChange: (v: string) => void;
  options: SearchOption[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);

  const display = (o: SearchOption) => (o.vacant ? "VAGO" : o.name);

  return (
    <div className="flex items-center gap-1 w-full sm:w-80">
      <div className="relative flex-1">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="pl-8 pr-8"
        />
        {value && (
          <button
            onClick={() => onChange("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Limpar"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="icon" aria-label="Selecionar colaborador">
            <ChevronsUpDown className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 p-0">
          <ScrollArea className="max-h-72">
            <div className="p-1">
              {options.length === 0 && (
                <div className="text-xs text-muted-foreground px-2 py-3 text-center">
                  Nenhum colaborador disponível.
                </div>
              )}
              {options.map((o) => {
                const label = display(o);
                const active = value.toLowerCase() === label.toLowerCase();
                return (
                  <button
                    key={o.id}
                    onClick={() => {
                      onChange(label);
                      setOpen(false);
                    }}
                    className={cn(
                      "w-full text-left px-2 py-1.5 rounded text-sm hover:bg-accent flex items-center gap-2",
                      active && "bg-accent",
                    )}
                  >
                    <Check
                      className={cn(
                        "h-3.5 w-3.5 shrink-0",
                        active ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className={cn("truncate", o.vacant && "font-bold tracking-wider")}>
                        {label}
                      </div>
                      {o.role && (
                        <div className="text-[11px] text-muted-foreground truncate">
                          {o.role}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>
    </div>
  );
}
