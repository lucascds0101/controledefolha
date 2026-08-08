# Atestado e Troca Casada como ocorrências normais

Hoje atestado e troca casada são lançados por diálogos próprios (pelo menu do colaborador), separados do editor de célula. A mudança transforma os dois em tipos de ocorrência lançáveis exatamente como Atraso, Falta, Saída antecipada etc. — mas mantendo todos os campos e confirmações que já existem hoje.

## Como fica

1. No editor de célula (clique em um dia do grid), a lista "Tipo de ocorrência" passa a incluir:
   - **Atestado**
   - **Troca casada**
2. Ao escolher **Atestado**, o formulário da ocorrência mostra os mesmos campos do diálogo atual: data de início (já preenchida com o dia clicado), quantidade de dias, data final calculada, CID e observação.
3. Ao escolher **Troca casada**, o formulário mostra: colaborador parceiro, data de trabalho, data de folga, observação, e as duas confirmações (trabalho confirmado / folga confirmada) com o selo de status Pendente/Concluída — igual ao diálogo atual.
4. Salvar pelo editor de célula cria/atualiza os registros nas mesmas tabelas de hoje, então os blocos "ATE" contínuos e as badges TC↑/TC↓ do grid continuam iguais e reativos.
5. Clicar num bloco de atestado ou numa badge de troca no grid abre o mesmo editor de célula, já posicionado na ocorrência correspondente, permitindo editar ou excluir.
6. A seleção por arraste de vários dias, ao escolher Atestado, preenche automaticamente o intervalo selecionado.
7. Os diálogos dedicados deixam de ser pontos de entrada no menu do colaborador — tudo passa pelo grid. O histórico já registrado continua visível e editável.

## Detalhes técnicos

- `src/lib/occurrence.ts`: adicionar `ATE` ao conjunto de tipos exibidos no seletor e reintroduzir `TC` em `OCC_TYPES` (hoje está fora da lista), com metadados de cor já existentes para TC e cor do atestado alinhada ao bloco atual.
- `src/components/cell-editor.tsx`: estender `CellOccurrence` com os campos de atestado (`start_date`, `days`, `end_date`, `cid`) e de troca (`partner_period_employee_id`, `partner_name`, `work_date`, `off_date`, `work_confirmed`, `off_confirmed`), renderizando os blocos condicionais reaproveitando o markup de `medical-leave-dialog.tsx` e `swap-dialog.tsx` (extraídos para subcomponentes de formulário reutilizáveis).
- `src/components/sheet-table.tsx`: o `onSave` do editor passa a rotear por tipo — `occurrences` para os tipos atuais, `employee_medical_leaves` para ATE e `employee_swaps` para TC (insert/update/delete), invalidando as mesmas queries já usadas; os handlers de clique nos blocos ATE e badges TC passam a abrir o `CellEditor` em vez dos diálogos dedicados.
- `src/components/employee-edit-dialog.tsx`: remover os botões/estados que abrem `MedicalLeaveDialog` e `SwapDialog` (férias permanece como está).
- Sem mudança de banco de dados: as tabelas `employee_medical_leaves` e `employee_swaps` continuam sendo a fonte dos dados.
