## Objetivo

Criar mecânica de Atestado por intervalo (semelhante a Férias), com quantidade de dias e CID opcional, mantendo também o atestado por célula já existente.

## Banco de dados

Nova tabela `public.employee_medical_leaves` (mesmo padrão de `employee_vacations`):
- `period_employee_id`, `source_employee_id` (para o atestado aparecer em todos os períodos do mesmo colaborador)
- `start_date`, `days` (int, ≥1), `end_date` (calculado = start + days − 1, armazenado para facilitar consultas)
- `cid` (texto, opcional)
- `note` (texto, opcional)
- Padrão: `user_id`, `created_at`, `updated_at`, RLS por `auth.uid()`, grants para `authenticated`/`service_role`.

## Diálogo `MedicalLeaveDialog`

Novo componente espelhado em `VacationDialog`:
- Campos: Data inicial (date), Dias (number, mín. 1), CID (opcional, texto curto).
- Data final é derivada e exibida somente-leitura.
- Lista dos atestados registrados (data → data, X dias, CID) com botão de remover.
- Aberto a partir do `EmployeeEditDialog`, ao lado do botão de Férias.

## Renderização na tabela

Em `sheet-table.tsx`:
- Buscar `employee_medical_leaves` do período (mesmo padrão da query de férias).
- Mapear `period_employee_id → Set<date>` cobertos pelo atestado (clipado ao período).
- Renderizar badge `ATE` (usando `ATESTADO_META`) em cada dia coberto, sobreposto às demais ocorrências, exatamente como o `FER` de férias.
- Célula continua clicável para permitir cobertura (adicionar outras ocorrências no dia).

## Página do colaborador (`/colaboradores/$id`)

- Buscar também `employee_medical_leaves` e listar em nova seção "Atestados" (datas + dias + CID).
- KPI `ATE` passa a somar: ocorrências ATE por célula + total de dias cobertos por atestados de intervalo (evitando dupla contagem no mesmo dia).

## Detalhes técnicos

- Regenerar `src/integrations/supabase/types.ts` após a migração (automático).
- Chaves de query novas: `medical-leaves`, `medical-leaves-by-period`; invalidar após criar/remover.
- Nenhuma mudança na lógica de plantão/folga nem no `CellEditor` (atestado por célula continua intacto).
- Nenhuma mudança em analytics/`analise.tsx` além de, opcionalmente, incluir dias de atestado de intervalo na contagem ATE (a confirmar na implementação — mesmo critério da página do colaborador).