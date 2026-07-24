Remover o motivo "Atestado" da lista de opções do campo **Motivo da Falta** no `CellEditor`, mantendo apenas "Injustificada" e "Abono".

### O que muda
- `src/lib/occurrence.ts`: alterar `FALTA_REASONS` de `["Atestado", "Injustificada", "Abono"]` para `["Injustificada", "Abono"]`.
- Remover a lógica visual especial do motivo "Atestado" dentro do tipo de ocorrência "Falta" (F), já que o módulo de Atestados por intervalo (`employee_medical_leaves`) já cobre esse caso e exibe a badge "ATE" no grid.
- Verificar se o helper `isAtestado` ainda é necessário em algum lugar; se o único uso era para o motivo "Atestado" dentro de Faltas, ajustar ou remover.
- Garantir que faltas existentes com motivo "Atestado" ainda sejam renderizadas corretamente no grid/histórico (fallback para "F" sem override visual), para não quebrar dados antigos.

### Pontos de atenção
- O motivo "Atestado" não será mais escolhível no dropdown de nova falta, mas faltas antigas com esse motivo continuarão legíveis.
- A badge "ATE" continua aparecendo via intervalos de atestados (`employee_medical_leaves`).
- A página de perfil do colaborador já separa a contagem de atestados por intervalo, então o KPI permanece preciso.