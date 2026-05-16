// Fixed role ordering for the table and dropdowns.
const ROLE_ORDER: Record<string, number> = {
  "Supervisão": 1,
  "Coordenação": 2,
  "Backoffice": 3,
  "PA": 4,
  "Operador de comunicação": 5,
  "Operador de monitoramento": 6,
};

// Roles whose members should be sorted alphabetically within their group.
const ALPHA_ROLES = new Set<string>([
  "Coordenação",
  "Backoffice",
  "Operador de comunicação",
  "Operador de monitoramento",
]);

export type SortableEmployee = {
  name: string;
  role: string | null;
  vacant: boolean;
  position: number;
};

function roleRank(role: string | null): number {
  if (!role) return 99;
  return ROLE_ORDER[role] ?? 99;
}

function displayName(e: SortableEmployee): string {
  return e.vacant ? "VAGO" : e.name;
}

export function sortEmployees<T extends SortableEmployee>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    const ra = roleRank(a.role);
    const rb = roleRank(b.role);
    if (ra !== rb) return ra - rb;
    if (a.role && ALPHA_ROLES.has(a.role)) {
      return displayName(a).localeCompare(displayName(b), "pt-BR", {
        sensitivity: "base",
      });
    }
    return a.position - b.position;
  });
}
