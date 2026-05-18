# Plano de implementação

Vou entregar a solicitação em blocos coesos. Como há muitos itens, listo abaixo o que farei e em que ordem.

## 1. Banco de dados (migrações)

- **`employee_role_history`** — registra cada mudança de cargo
  - `employee_id` (referência ao colaborador "fonte"), `from_role`, `to_role`, `changed_at`, `note`, `user_id`
  - RLS: owner-only (auth.uid = user_id)
- **`employees.role`** — passa a ser o "cargo atual oficial" do colaborador (já existe). O Kanban opera sobre `employees`, não sobre `period_employees`.
- Manter `period_employees.role` como snapshot do período (atual comportamento), mas, ao mover no Kanban, atualizar também o cargo do colaborador-fonte em todos os períodos **futuros e atual**, registrando histórico.

## 2. Página `/colaboradores` (Kanban)

- Nova rota `src/routes/colaboradores.tsx` + item no `app-sidebar`.
- Colunas fixas na ordem hierárquica:
  Supervisão · Coordenação · Backoffice · PA · Operador de comunicação · Operador de monitoramento.
- Cards com nome, cargo, status (Ativo / Vago / Férias hoje).
- Drag-and-drop com `@dnd-kit/core` + `@dnd-kit/sortable` (instalar).
- Ao soltar:
  - `UPDATE employees SET role = ...`
  - `INSERT INTO employee_role_history (...)`
  - Atualiza `period_employees.role` dos períodos cujo `end_date >= hoje`.
- Animações via `framer-motion` (`layout` + `AnimatePresence`).
- Botão "Novo colaborador" e clique no card abre o perfil.

## 3. Perfil do colaborador `/colaboradores/$id`

Layout administrativo com abas:

- **Dados** — nome, cargo, status, ações (editar, marcar vago, excluir).
- **Histórico** — sanções, ocorrências, férias, mudanças de cargo (timeline).
- **Análise** — seletor de período (date range), filtros por tipo, KPIs (faltas, atrasos, extras, saídas antecipadas, sanções, férias, trocas casadas) e gráficos (barras por tipo, linha por mês) usando `recharts` (já no projeto).

## 4. Cabeçalho da tabela fixo (sticky)

- Em `sheet-table.tsx`: a `<th>` da coluna "Colaborador" já é `sticky left-0`. Falta combinar com `sticky top-0` na linha de datas mantendo a interseção: aplicar `z-index` superior na célula canto e ajustar `position: sticky` em `thead > tr > th` (já existe `sticky top-0`, mas o canto perde prioridade — corrigir z-index e background).

## 5. Detecção automática de escala (Semana 1 / Semana 2)

- Em `src/lib/schedule.ts`: nova função `inferScheduleFromAnchor(anchorDate, anchorType, rangeStart, rangeEnd)` que, dada uma âncora manual (P ou F num dia da semana), determina se aquele dia pertence à Semana 1 ou Semana 2 (comparando contra os 2 padrões fixos) e propaga para trás/frente alternando a cada 7 dias.
- Em `sheet-table.tsx`, ao usuário definir P/F manualmente em um dia (via `DayTypeCell`):
  - Recalcular `period_days` faltantes para o período inteiro.
  - Não sobrescrever dias que já foram editados manualmente (marcador `manual: true` — adicionar coluna `manual boolean default false` em `period_days`).
- Indicação visual: rótulo "S1"/"S2" discreto acima de cada grupo de 7 dias no header, com cor alternada.
- Remover seleção manual de Semana 1/2 do `NewPeriodDialog` (passa a ser automático após o usuário ancorar um dia; até lá fica vazio).

## 6. Ocorrências

- **Extra apenas em Folga**: em `cell-editor.tsx`, filtrar `EX` da lista quando `day_type === 'plantao'`. Passar `dayType` como prop (já temos via `dayTypeMap`).
- **Motivos de Falta**: estender o `Select` de motivos para incluir Hospital, Prob. pessoal, Licença, Prob. VT, Afastamento, Desligamento, Outros (além dos atuais).
- **Atestado destacado**: novo token `--occ-ate-bg/--occ-ate` em `styles.css` (azul/teal), render diferenciado quando `type === 'F' && reason === 'Atestado'` — badge "ATE" em vez de "F", refletir nas métricas da página de análise (contagem separada).

## 7. Favicon e identidade

- Gerar ícone (gradiente da paleta primária + glifo de planilha).
- Adicionar `<link rel="icon">` (light/dark via `media="(prefers-color-scheme: dark)"`) no `head()` do `__root.tsx`.

## 8. Arquivos previstos

Novos:
- `supabase/migrations/<ts>_role_history_and_manual_days.sql`
- `src/routes/colaboradores.tsx`, `src/routes/colaboradores.$id.tsx`
- `src/components/kanban-board.tsx`, `src/components/employee-card.tsx`, `src/components/employee-profile.tsx`, `src/components/employee-analytics.tsx`
- `public/favicon.svg` (claro/escuro)

Editados:
- `src/components/sheet-table.tsx` (header sticky, Extra-only-Folga via prop, atestado, recálculo automático)
- `src/components/cell-editor.tsx` (motivos de falta, filtro Extra, badge atestado)
- `src/components/day-type-cell.tsx` (trigger recálculo automático)
- `src/lib/schedule.ts` (inferência automática)
- `src/lib/occurrence.ts` (meta para atestado, novos motivos)
- `src/components/new-period-dialog.tsx` (remover seleção manual de semana)
- `src/components/app-sidebar.tsx` (link Colaboradores)
- `src/routes/__root.tsx` (favicons)
- `src/styles.css` (token atestado, cores semana)

## 9. Pacotes a instalar

- `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`

---

Posso prosseguir nessa ordem? Se quiser, posso fatiar em entregas menores (ex.: Kanban + perfil primeiro, depois escala automática, depois ocorrências/favicon).
