## Resumo

Criar o módulo **Troca Casada por intervalo** seguindo o mesmo padrão de Férias/Atestados: dialog aberto pelo editor do colaborador, com dashboard-resumo dentro do próprio dialog, lista, filtros e badges no grid. A ocorrência TC por célula é aposentada.

## Banco de dados (uma migração)

Nova tabela `public.employee_swaps`:

- `user_id uuid` (dono, RLS por `auth.uid()`)
- `period_employee_id uuid` (colaborador no período, obrigatório)
- `source_employee_id uuid` (colaborador base, para persistir entre períodos — igual FER/ATE)
- `partner_period_employee_id uuid null` (colaborador envolvido, opcional)
- `partner_source_employee_id uuid null`
- `work_date date not null` (dia que vai trabalhar / pagando)
- `off_date date not null` (dia que vai folgar / recebendo)
- `work_confirmed bool default false`, `work_confirmed_at timestamptz null`
- `off_confirmed bool default false`, `off_confirmed_at timestamptz null`
- `canceled bool default false`, `canceled_at timestamptz null`
- `note text null`
- `created_at`, `updated_at` + trigger `set_updated_at`
- `check (work_date <> off_date)`

RLS: policy única `user_id = auth.uid()`. GRANTs SELECT/INSERT/UPDATE/DELETE para `authenticated` e ALL para `service_role`.

## Novo componente `src/components/swap-dialog.tsx`

Mesma estrutura visual de `medical-leave-dialog.tsx` / `vacation-dialog.tsx`.

Conteúdo:

1. **Resumo do período** (mini dashboard no topo): 4 cards pequenos — Total, Pendentes de confirmação, Confirmadas, Canceladas — calculados a partir das trocas do colaborador no período aberto.
2. **Formulário de nova troca**:
   - Data trabalho (input date, restrito ao intervalo do período)
   - Data folga (input date, restrito ao intervalo do período)
   - Colaborador envolvido (opcional) — combobox reaproveitando `EmployeeSearch` sobre `period_employees` do período atual
   - Observação (textarea opcional)
   - Botão **Adicionar troca**
3. **Lista de trocas** do colaborador no período, ordenadas por data mais próxima:
   - Datas formatadas (Trabalho → Folga)
   - Parceiro (se houver)
   - **Badge de status** por etapa (trabalho / folga): Agendada · Pendente · Confirmada · Cancelada
   - Botão **Confirmar presença** liberado quando `date <= hoje` e ainda não confirmado nem cancelado (uma ação por etapa)
   - Ações: **Editar** (só se ambas as datas ainda no futuro e não cancelada), **Cancelar** (marca `canceled`), **Excluir**

Regra de status derivada (front, sem coluna):

```text
etapa (work/off):
  canceled          → "Cancelada"
  confirmed         → "Confirmada"
  date > hoje       → "Agendada"
  date <= hoje      → "Pendente de confirmação"
```

## Validações no dialog

Antes de gravar (mensagens amigáveis via `toast.error`):

- `work_date` e `off_date` dentro de `[period.start_date, period.end_date]`.
- `work_date !== off_date`.
- **Contagem de datas ativas** (não canceladas) do colaborador no período (somando `work_date` + `off_date` das trocas existentes) + as 2 datas novas ≤ 2. Se exceder: "Este colaborador já atingiu o limite de 2 trocas casadas neste período".

Mesma validação server-side não é necessária (RLS + regra visual), mas o dialog bloqueia o botão quando a contagem já está no limite.

## Integração no editor do colaborador

Em `employee-edit-dialog.tsx`, adicionar botão **Troca casada** (ícone `Repeat` do lucide) ao lado dos botões Férias/Atestado, abrindo o novo `SwapDialog`. Passa `periodEmployeeId`, `sourceEmployeeId`, `employeeName` e o `period` atual (para limites de data).

## Grid (SheetTable)

- Adicionar query `swaps-by-period` (todas as trocas não canceladas do período) e construir dois mapas virtuais via `buildRangeMap`: um marca `work_date` como "TC-T" (trabalho) e outro `off_date` como "TC-F" (folga).
- Renderizar **badges virtuais TC** nas células correspondentes, com o mesmo tratamento de sobreposição usado hoje para FER/ATE (permite lançar ocorrência real por cima).
- Cor do badge: reaproveitar tokens `occ-tc` já existentes.

## Aposentadoria da ocorrência TC por célula

- Remover `"TC"` de `OCC_TYPES` em `src/lib/occurrence.ts` (mantém a entrada em `OCC_META` para renderizar registros históricos).
- Remover o formulário TC de `cell-editor.tsx` (bloco `type === "TC"`).
- Ocorrências TC antigas continuam visíveis no grid/histórico (não são apagadas do banco); apenas não podem mais ser criadas.
- Ajustar `src/routes/colaboradores.$id.tsx` para deixar de contar TC nos KPIs de ocorrência (a contagem passa a ser derivada das trocas confirmadas, se desejado num passo futuro — não incluído nesta entrega).

## Perfil do colaborador — mínimo necessário

Sem novo KPI nesta entrega. Apenas: nova seção "Trocas casadas" na aba Histórico listando as trocas do colaborador (todas as períodos), no mesmo estilo das seções Férias/Atestados, mostrando datas, parceiro e status por etapa.

## Fora do escopo

- Página dedicada `/trocas` no menu (você optou por manter apenas dialog).
- Migração das ocorrências TC existentes para o novo modelo.
- Notificações/lembretes de confirmação.

## Arquivos afetados

- **Novo**: `src/components/swap-dialog.tsx`
- **Migração**: criação de `employee_swaps` (+ RLS/GRANTs/trigger)
- **Editar**: `src/components/employee-edit-dialog.tsx` (botão), `src/components/sheet-table.tsx` (query + badges), `src/components/cell-editor.tsx` (remove form TC), `src/lib/occurrence.ts` (remove TC de `OCC_TYPES`), `src/routes/colaboradores.$id.tsx` (seção histórico)
