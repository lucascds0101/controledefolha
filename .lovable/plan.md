Mover o campo de pesquisa de colaborador do cabeçalho da página para o cabeçalho da coluna "Colaborador" no grid.

## Alterações

1. **Remover busca do cabeçalho da página**
   - `src/routes/index.tsx`: remover o componente `EmployeeSearch` do header superior e o estado/querie auxiliares que só existem para alimentá-lo (`searchOptions`, `options`).

2. **Incluir bussa no cabeçalho da coluna do grid**
   - `src/components/sheet-table.tsx`: adicionar um campo de input com ícone de busca diretamente no `<th>` da coluna "Colaborador" (linha ~742).
   - O componente deve continuar filtrando a lista de colaboradores por nome/cargo/vago, mantendo a mesma lógica de filtro existente (`filtered`).
   - Ajustar o prop `SheetTable` para receber o valor de busca e o callback de alteração (`search`, `onSearchChange`) vindo do `index.tsx`.

3. **Preservar UX**
   - Manter o botão de limpar (×) quando houver texto.
   - Garantir que o campo não quebre a largura fixa da coluna colaborador (`min-w-[240px]`).
   - O campo deve ser visível e acessível no cabeçalho sticky da coluna.
