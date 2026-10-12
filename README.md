# Meu Financeiro

Aplicação de gestão financeira com contas individuais, lançamentos persistidos em PostgreSQL, painel mensal e relatórios por categoria.

## Requisitos

- Node.js 20 ou superior
- PostgreSQL acessível pela aplicação

## Configuração local

1. Instale as dependências:

   ```bash
   npm install
   ```

2. Copie `.env.example` para `.env` e configure `DATABASE_URL` e `SESSION_SECRET`.

3. Crie/atualize as tabelas do banco conforme o schema:

   ```bash
   npx prisma db push
   npx prisma generate
   ```

4. Inicie o ambiente de desenvolvimento:

   ```bash
   npm run dev
   ```

5. Acesse [http://localhost:3000](http://localhost:3000), crie sua conta e comece a registrar lançamentos.

`SESSION_SECRET` deve ser uma chave aleatória com pelo menos 32 caracteres. Em produção, configure-a no gerenciador de segredos do ambiente; não reutilize o valor de exemplo.

## Funcionalidades

- Cadastro e login com sessão em cookie `HttpOnly`.
- Lançamentos de receitas e despesas, com categoria, data, edição e exclusão.
- Painel com resumo mensal, busca, filtros e exportação CSV.
- Relatório mensal com margem, saldo e despesas por categoria.
- Dados de cada conta filtrados no servidor pela sessão autenticada.
