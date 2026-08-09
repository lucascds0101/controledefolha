# Página de Bloqueios (Extra / Troca Casada)

Nova página para controlar quem está temporariamente impedido de fazer Extra ou Troca casada, com bloqueios criados automaticamente pelas ocorrências e também manualmente.

## O que será construído

**1. Registro de bloqueios (banco)**
Nova tabela `employee_blocks` com: colaborador (vínculo ao snapshot do período e ao cadastro central), motivo, data de início, data de término, observação, origem (automático/manual), status (ativo/encerrado) e vínculo à ocorrência de origem. Acesso restrito ao próprio usuário, como nas demais tabelas.

**2. Bloqueio automático**
Ao salvar no grid uma ocorrência de **Falta injustificada** ou **Atestado**, o sistema cria um bloqueio de 7 dias (início = data da ocorrência; término = início + 7 dias), com motivo correspondente e origem "Automático".
- Vale para toda falta injustificada e todo atestado, inclusive faltas cobertas.
- O bloqueio fica vinculado ao registro de origem; se a ocorrência for editada, as datas do bloqueio são recalculadas; se excluída, o bloqueio é removido. Não há duplicação para a mesma ocorrência.
- No atestado, o início é o primeiro dia do atestado.
- Períodos sobrepostos do mesmo colaborador aparecem como registros distintos, mas o indicador "bloqueado até" usa sempre o término mais distante.

**3. Cadastro manual**
Modal com Colaborador, Motivo, Início, Término e Observação. Origem "Manual". Qualquer período é permitido.

**4. Página `/bloqueios`**
- Cards no topo: Bloqueios ativos, Encerrando nos próximos 7 dias, Automáticos, Manuais — recalculados automaticamente.
- Tabela: Colaborador | Motivo | Início | Término | Dias | Origem | Status | Ações.
- Ações: Editar (inclusive dos automáticos), Encerrar bloqueio (define término = hoje e status encerrado) e Excluir.
- Bloqueios ativos com destaque visual; encerrados visíveis também.
- Filtros: busca por nome, status, motivo, origem, intervalo de datas e atalho "somente ativos agora".
- Mesmos componentes visuais já usados no sistema (sidebar, cards, tabela, selects, diálogos, sonner).

**5. Aviso no lançamento de Extra / Troca casada**
No editor de célula do grid, ao escolher **EX** ou **TC** para um colaborador com bloqueio ativo na data, aparece um aviso destacado com motivo e período do bloqueio. O gestor pode salvar mesmo assim (aviso, não impedimento).

**6. Menu**
Novo item "Bloqueios" na barra lateral, apontando para `/bloqueios`.

## Detalhes técnicos

- Migração cria `public.employee_blocks` (colunas: `user_id`, `period_employee_id`, `source_employee_id`, `employee_name`, `reason`, `start_date`, `end_date`, `note`, `origin` `'auto'|'manual'`, `status` `'ativo'|'encerrado'`, `source_kind` `'falta'|'atestado'|null`, `source_id`, timestamps) com GRANTs, RLS por `auth.uid()`, trigger `set_updated_at` e índice único parcial em `source_id` para evitar duplicidade.
- A criação/atualização/remoção automática entra na mutation `saveCell` de `src/components/sheet-table.tsx`, junto do fluxo que já grava `occurrences` e `employee_medical_leaves` — reconciliando os bloqueios por `source_id` após salvar.
- Nova rota `src/routes/bloqueios.tsx` seguindo o padrão de `src/routes/analise.tsx` (AppSidebar, guarda de sessão, TanStack Query) + `src/components/block-dialog.tsx` para criar/editar.
- Status efetivo é derivado das datas (ativo se hoje entre início e término e não encerrado manualmente), evitando depender de job agendado.
- `head()` próprio na rota com título e descrição específicos.
