
## 1. Colaboradores e ocorrências por período (mudança maior)

Hoje a tabela `employees` é global por usuário — qualquer edição (nome, cargo, vago) ou exclusão afeta todos os períodos. Vou trocar o modelo:

- Nova tabela `period_employees(id, user_id, period_id, position, name, role, vacant, created_at, updated_at)`. Cada período tem sua própria lista.
- Ao **criar** um novo período, copio automaticamente as linhas do período mais recente (snapshot), preservando ordem, nome, cargo e estado vago/não vago.
- `occurrences.employee_id` passa a referenciar `period_employees.id`. Como o `employee_id` atual é UUID livre (sem FK), a migração apenas reaponta as ocorrências existentes para os novos `period_employees` correspondentes (gera 1 `period_employee` por par único `(period_id, employee_id)` usando o último nome/cargo conhecido do `employees`).
- A tabela `employees` original fica obsoleta. Mantenho a tabela existente no banco para não perder histórico, mas deixa de ser usada pelo app (sem novas escritas/leituras).
- Efeito prático:
  - **Adicionar / excluir / editar colaborador**: salva apenas no período selecionado.
  - **Marcar VAGO**: agora é por período. Quando vago, a tabela mostra `VAGO` no lugar do nome (o nome original não aparece). Em outros períodos o colaborador continua com o nome.
  - **Ocorrências**: já eram por período, mas agora passam a apontar para o `period_employee` certo, então removendo um colaborador de um período não some com o do outro.

## 2. Contador total de colaboradores

No cabeçalho da folha, ao lado do título, mostrar `N colaboradores` (e `M vagos` quando houver), contando os do período atual.

## 3. Página de Configurações (modal centralizado)

Substituo o botão "Cargos" e o `ThemeToggle` do header por um único botão "Configurações" que abre um modal central com 3 abas/cartões:

- **Aparência** — alternância tema claro/escuro.
- **Cargos** — reaproveita o `RolesManager` existente embutido na aba.
- **Conta** — formulário "Redefinir senha" (informa email; usa `supabase.auth.resetPasswordForEmail` para usuário logado).

Visual limpo, bordas suaves, sem ruído.

## 4. Página de Análise de ocorrências

Nova rota `/analise`:
- Filtro por período (dropdown).
- Pesquisa por colaborador (input).
- Cards de resumo (total por tipo: A / TC / F / SA, total de presenças automáticas).
- Lista detalhada agrupada por colaborador → cada ocorrência com data, tipo, observações (motivo, horário, parceiro de troca, etc., usando `summaryFor`).
- Linka no menu lateral.

## 5. Sidebar recolhível e moderna

Refaço a `PeriodSidebar` com largura `w-14` recolhida → `w-64` ao passar o mouse ou clicar (toggle persistente em `localStorage`). Animação `transition-[width] duration-300 ease-out`. Itens com ícones sempre visíveis, labels aparecem ao expandir. Inclui:
- Logo
- "Períodos" (lista + criar)
- "Análise" → navega para `/analise`
- "Configurações" → abre modal
- "Sair"

## 6. Destaque do dia atual + estados visuais

Usar `new Date()` em horário local para identificar a coluna de "hoje".
- Hoje: borda destacada, fundo `bg-primary/10`, número em destaque.
- Passado: opacidade normal, foreground um pouco mais claro (`text-muted-foreground/90`).
- Futuro: opacidade reduzida (`opacity-60`) tanto no header quanto nas células.
Aplicado tanto no `<th>` quanto no `<td>` correspondente.

## 7. Presença automática (verde)

Em qualquer célula `(empregado, dia)`:
- se `day_type === 'plantao'`,
- e `data <= hoje`,
- e a célula **não tem nenhuma ocorrência registrada**,
→ pinta de verde com etiqueta "P" (Presença) e tooltip "Presença confirmada".

Não aplica em folgas, dias futuros, ou quando há qualquer ocorrência. Cor verde semântica nova nos tokens (`--occ-p` / `--occ-p-bg`).

## Detalhes técnicos

- Migration nova com `period_employees`, RLS por `user_id`, trigger de `updated_at`, e backfill via `INSERT … SELECT DISTINCT period_id, employee_id …`.
- Trigger `on_period_insert`: ao criar um período, copia colaboradores do período anterior (mais recente) do mesmo usuário.
- Atualizar `SheetTable`, `Dashboard`, `EmployeeEditDialog`, queries para usar `period_employees`.
- Rota nova `src/routes/analise.tsx` + `src/components/settings-dialog.tsx`.
- Sidebar reescrita (custom, não shadcn Sidebar — é só uma coluna simples com ícones).

Posso seguir?
