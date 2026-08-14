# Resumo Geral do Período

Adicionar um alternador (toggle) no topo da planilha que troca a visão de dias por uma tabela de resumo por colaborador, contando apenas o período selecionado.

## Como funciona

- Dois botões no cabeçalho da planilha: "Planilha" e "Resumo geral".
- Ao escolher "Resumo geral", a grade de dias é substituída por uma tabela compacta com uma linha por colaborador.
- A busca por colaborador continua funcionando nas duas visões, assim como a ordenação atual (cargo, nome, vagos por último).

## Colunas do resumo

| Coluna | Conteúdo |
| --- | --- |
| Colaborador | Nome (ou VAGO) + cargo |
| Atrasos | Quantidade de ocorrências tipo A |
| Faltas injustificadas | Faltas com motivo Injustificada/Injustificado |
| Extras | Ocorrências tipo EX |
| Atestados | Quantidade de atestados que tocam o período |
| Trocas casadas | Trocas não canceladas no período |
| Bloqueio | Selo "Bloqueado" (com motivo e data final) ou "Livre" |

- Números em zero ficam apagados; valores maiores destacam com a cor já usada para cada tipo de ocorrência.
- Uma linha final de totais da equipe.
- Clicar no número leva a nada por enquanto (somente leitura), e clicar no selo de bloqueio abre a página Bloqueios.

## Detalhes técnicos

- Novo componente `src/components/summary-table.tsx`, alimentado pelos dados já carregados em `sheet-table.tsx` (`occurrences`, `medicalLeaves`, `swaps`, `blocks`, `customs` não entram na contagem).
- Estado `view: "grid" | "summary"` local no `SheetTable`; nenhuma consulta nova ao banco e nenhuma mudança de schema.
- Contagens derivadas com `useMemo`: filtros por `period_employee_id`/`source_employee_id` e interseção de datas com `period.start_date`/`period.end_date`; bloqueio via `isActive` de `src/lib/blocks.ts`.
