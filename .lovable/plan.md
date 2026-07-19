## Objetivo
1. Remover completamente a página de gerenciamento de colaboradores (kanban).
2. Permitir abrir o perfil do operador clicando no nome dele dentro do grid principal.

## Alterações

### Remover a página de colaboradores
- Excluir `src/routes/colaboradores.tsx` (kanban por cargo).
- Manter `src/routes/colaboradores.$id.tsx` (perfil individual) — continua sendo a rota de destino ao clicar no nome.
- Remover qualquer link/atalho para `/colaboradores` na navegação:
  - `src/components/app-sidebar.tsx` (se houver item de menu apontando para a lista).
  - Qualquer botão/CTA em outras telas apontando para a listagem.
- `src/routeTree.gen.ts` é regenerado automaticamente; não editar manualmente.

### Tornar o nome clicável no grid principal
- Em `src/components/sheet-table.tsx`, na coluna fixa do colaborador:
  - Envolver o nome (não a linha inteira) em um `<Link to="/colaboradores/$id" params={{ id: source_employee_id ?? period_employee.id }}>`.
  - Estilo: hover com sublinhado sutil e cor primária; cursor pointer.
  - Para colaboradores marcados como **VAGO**: exibir "VAGO" sem link (não há perfil a abrir).
  - O clique no nome NÃO deve disparar edição inline nem abrir o `EmployeeEditDialog`; a edição continua acessível pelo ícone/ação já existente ao lado do nome.
- `stopPropagation` no clique do link para não conflitar com handlers da linha/célula.

### Não alterar
- Perfil `/colaboradores/$id` permanece igual (já existe).
- Estrutura do banco não muda.
- Nenhuma outra funcionalidade da folha é alterada.

## Confirmação antes de implementar
- Está ok remover **inteiramente** a página kanban `/colaboradores` (não apenas ocultar)? Se preferir apenas esconder do menu mantendo o arquivo, me avise.
