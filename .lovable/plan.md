## Resumo do escopo

Limpar a página principal, melhorar busca/sidebar/presença automática, preparar criação de período com escala semanal automática, adicionar férias, sanção disciplinar, extra (folga) e ordenação fixa por cargo.

---

## 1. Página principal mais limpa

- Remover do `Dashboard` os cards: Atrasos, Troca casada, Faltas, Saídas antecipadas e Resumo por colaborador.
- Manter apenas: cabeçalho do período, contador de colaboradores/vagos, e a `SheetTable`.
- Mover/garantir que todas as métricas e resumos vivam apenas em `/analise`.

## 2. Campo de busca de colaborador

- Componente reutilizável `EmployeeSearch` com input + dropdown (Popover + Command):
  - Página principal: opções = colaboradores do **período atual**.
  - Página de análise: opções = união distinta de todos os `period_employees` do usuário (todos os períodos).
- Filtra a tabela / lista por seleção ou texto digitado.

## 3. Bug do sidebar

- Refatorar `AppSidebar` com estado único `expanded: boolean` controlado por clique no botão hambúrguer. Toggle real (não combina hover + pin que estava travando). Persistir em `localStorage`. Largura `w-14` ↔ `w-64` com `transition-[width] duration-300 ease-out`. Sem listeners de `mouseenter/leave` conflitando.

## 4. Escala semanal automática na criação do período

- No dialog "Novo período" (em `AppSidebar`), adicionar seletor "Semana inicial" (Semana 1 / Semana 2) + **mini-calendário visual** mostrando os 7 dias com cor verde (Plantão) e cinza (Folga), atualizando conforme alterna.
- Escalas fixas:
  - **S1**: Seg P, Ter F, Qua P, Qui F, Sex F, Sáb P, Dom P
  - **S2**: Seg F, Ter P, Qua F, Qui P, Sex P, Sáb F, Dom F
- Função `computeScheduleDays(start, end, startingWeek)`: itera dias, alterna S1↔S2 a cada semana ISO (segunda como início), atribui Plantão/Folga.
- Ao criar período, popular `period_days` com `day_type` calculado. Edição manual posterior em `day-type-cell` segue funcionando (já existe).
- Aplicar a mesma lógica no trigger do banco? Não — manter no frontend para evitar travar criação se o usuário pular o passo. O default das células sem registro continua sendo "Plantão", então só inserimos as exceções (folgas) + plantões explícitos.

## 5. Bug da presença automática (verde)

- Em `SheetTable`, garantir comparação de strings ISO (não `Date`) usando `todayISO()`. Hoje a comparação pode estar usando `<= new Date()` errado.
- Recalcular sempre que muda `occurrences`, `period_days`, `today`, `period`. Usar `useMemo` com chaves corretas.
- Excluir dias com tipo "ferias" ou "suspensao" (novos) da regra.
- React Query: invalidar `["occurrences", periodId]` e `["period_days", periodId]` após mutações já garante repintura.

## 6. VAGO mostra cargo

- Em `SheetTable` e listas: quando `vacant=true`, exibir o nome como "VAGO" mas manter `role` visível abaixo (como já é com não-vagos). Hoje o cargo está oculto quando vago — remover essa condição.

## 7. Férias

- Adicionar dropdown "Férias" no `EmployeeEditDialog` com data inicial/final.
- Migration: adicionar coluna `day_type` aceitar novos valores `'ferias'` e `'suspensao'` (atual é texto livre, então só convenção). Adicionar tabela `employee_vacations(id, user_id, period_employee_id, start_date, end_date)` com RLS.
- Ao salvar, regerar visualização: as células dentro do intervalo recebem badge "FÉRIAS" com cor própria (novo token `--occ-fer`).
- Cada dia continua editável: o `CellEditor` numa célula de férias mostra opções "Posto coberto?" + "Coberto por" (igual falta), sem remover o registro de férias do dia.
- Edições individuais NÃO removem o intervalo — somente sobrescrevem a célula com a ocorrência específica.

## 8. Sanção disciplinar (nova ocorrência tipo `SD`)

- Migration: adicionar `'SD'` ao enum `occurrence_type`; novas colunas `sanction_kind text` (Advertência verbal/escrita/Suspensão) e `suspension_days int`.
- No `CellEditor`, novo tipo "Sanção disciplinar" com dropdown e campo condicional de dias quando "Suspensão". Campo de observação (`note` já existe).
- Token visual `--occ-sd` (roxo).
- Conta em `/analise`.
- Dias dentro do intervalo de suspensão também ficam excluídos da regra de presença automática (caso queira marcar como suspensão diária — opcional, por ora ligado só por ocorrência SD individual).

## 9. Ocorrência "Extra" exclusiva para folgas (`EX`)

- Migration: adicionar `'EX'` ao enum.
- Em `CellEditor`: se `day_type === 'folga'`, **único** tipo disponível é "Extra". Se `plantao`, esconder "Extra".
- Token visual próprio `--occ-ex` (azul-petróleo).
- Conta em `/analise`.

## 10. Ordenação fixa por cargo

- Helper `sortEmployees(emps)`:
  - Mapa de ordem: Supervisão=1, Coordenação=2, Backoffice=3, PA=4, Operador de comunicação=5, Operador de monitoramento=6, outros=99.
  - Dentro de Coord/Back/Op.Com/Op.Mon → ordem alfabética por nome (VAGO mantém nome do cargo, ordenado por `name` mesmo, então "VAGO" cai no fim alfabético — aceitável; mantém na seção).
  - Supervisão e PA mantêm ordem de cadastro (`position`).
- Aplicar em: `SheetTable` (linhas), dropdown da página principal, dropdown da análise, listas da `/analise`.

---

## Detalhes técnicos (migrations)

```sql
-- 1) Novos tipos de ocorrência
ALTER TYPE occurrence_type ADD VALUE IF NOT EXISTS 'SD';
ALTER TYPE occurrence_type ADD VALUE IF NOT EXISTS 'EX';

-- 2) Colunas de sanção
ALTER TABLE occurrences
  ADD COLUMN sanction_kind text,
  ADD COLUMN suspension_days int;

-- 3) Tabela de férias
CREATE TABLE public.employee_vacations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  period_employee_id uuid NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.employee_vacations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vacations own all" ON public.employee_vacations
  FOR ALL TO authenticated USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
CREATE TRIGGER set_updated_at_vacations BEFORE UPDATE ON public.employee_vacations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

---

## Arquivos a criar/editar

**Criar:**
- `src/components/employee-search.tsx` — input + dropdown reutilizável
- `src/lib/schedule.ts` — escalas S1/S2 e `computeScheduleDays`
- `src/components/schedule-preview.tsx` — visualização dos 7 dias S1/S2
- `src/components/new-period-dialog.tsx` — extraído do sidebar, com escala + preview
- `src/components/vacation-dialog.tsx` — definir férias do colaborador
- `src/lib/sort-employees.ts` — ordenação fixa

**Editar:**
- `src/components/dashboard.tsx` — remover cards de métricas/resumo
- `src/components/app-sidebar.tsx` — corrigir toggle expand/collapse
- `src/components/sheet-table.tsx` — VAGO com cargo, presença auto corrigida, exclusão férias/SD-suspensão, ordenação, badges férias/EX/SD
- `src/components/cell-editor.tsx` — tipos SD e EX condicionais, cobertura em férias
- `src/components/employee-edit-dialog.tsx` — botão "Férias"
- `src/routes/analise.tsx` — usar `EmployeeSearch` global + contagens SD/EX/Férias
- `src/lib/occurrence.ts` — adicionar SD, EX, helpers
- `src/styles.css` — tokens `--occ-fer`, `--occ-sd`, `--occ-ex`

Posso seguir?
