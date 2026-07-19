## Objetivo

Hoje, ao definir um dia como Plantão ou Folga no cabeçalho da tabela, o dia é gravado como uma **âncora manual** (`manual: true`) — outros ajustes futuros na escala não recalculam esse dia. Você quer que qualquer dia editado seja tratado igual aos dias auto-calculados: uma nova edição em qualquer outro dia deve conseguir recalculá-lo também.

## Mudança

Arquivo: `src/components/day-type-cell.tsx`

- Ao gravar/atualizar um `period_days`, sempre usar `manual: false` (em vez de `true`). O dia editado ainda serve de referência para inferir a escala S1/S2 do período naquele momento, mas não fica "travado".
- Continuar existindo a lógica de "última edição vence": a mutação já recalcula todos os dias não-manuais do período a partir do último dia clicado. Como agora nenhum dia é manual, qualquer nova edição em qualquer outro dia recalcula todos, inclusive os que já haviam sido tocados.
- Trocar o rótulo "Limpar âncora" por "Limpar", já que o conceito de âncora persistente deixa de existir.
- Nenhuma migração de banco é necessária. A coluna `manual` continua no schema; simplesmente deixa de ser marcada como `true` por essa UI. Registros antigos com `manual: true` seguirão travados até serem clicados novamente — se quiser, posso adicionar um passo extra para "destravar" registros antigos automaticamente ao carregar (me avise).

## Resultado esperado

- Clicar em qualquer dia do cabeçalho define P/F, e a partir dele o restante do período é recalculado.
- Clicar em outro dia depois recalcula tudo de novo, inclusive dias que você já havia editado — nenhum dia fica "preso".
