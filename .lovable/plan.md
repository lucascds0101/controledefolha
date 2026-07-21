## Problema

Na página `/colaboradores/$id`, o KPI "Atestados" (ATE) só conta ocorrências do tipo Falta com motivo "Atestado" (atestado por célula). Os atestados por intervalo (tabela `employee_medical_leaves`) não são buscados nem contabilizados.

## Correção em `src/routes/colaboradores.$id.tsx`

1. Adicionar query `profile-medleaves` para buscar `employee_medical_leaves` filtrando por `source_employee_id.eq.${id}` ou `period_employee_id.in.(peIds)`, com intervalo cruzando a janela `from`/`to` (mesmo padrão da query de férias).
2. No `useMemo` de `counters`:
   - Calcular o conjunto de dias cobertos por atestados de intervalo (clipado a `from`/`to`) via `eachDay` de `@/lib/occurrence`.
   - Somar em `c.ATE` os dias do intervalo, evitando dupla contagem quando já existe uma ocorrência ATE por célula no mesmo dia (união de datas).
3. Adicionar nova `Section` "Atestados (intervalo)" na aba Histórico, listando `start_date → end_date`, `X dias` e `CID` quando presente — espelhando a seção de Férias.
4. Chart data e demais KPIs permanecem inalterados (o valor de `counters.ATE` já alimenta o gráfico).

Nenhuma mudança em `sheet-table.tsx`, banco ou outras rotas.
