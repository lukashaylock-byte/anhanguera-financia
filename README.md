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

## Publicação na Vercel

- Configure `DATABASE_URL` para o banco PostgreSQL de produção e `SESSION_SECRET` como uma chave aleatória própria com pelo menos 32 caracteres. Não use o valor de exemplo nem publique segredos no Git.
- O `vercel.json` configura o build de produção para aplicar as migrações de `prisma/migrations` antes de compilar o Next.js.
- O Prisma Client é gerado durante a instalação das dependências.
- Após configurar as variáveis, publique uma nova implantação de produção.

## Funcionalidades

- Cadastro e login com sessão em cookie `HttpOnly`.
- Lançamentos de receitas e despesas com categorias livres, vencimentos, situação e centros de custo.
- Contas pendentes a pagar e a receber, com baixa rápida após pagamento ou recebimento.
- Painel de fluxo de caixa mensal com valores realizados e saldo projetado.
- Página de contas a pagar e receber com filtros por situação e tipo, vencimentos e baixa rápida.
- Análise dedicada de centros de custo com despesas agrupadas por área, categoria ou projeto.
- Busca, filtros, edição, exclusão e exportação CSV com vencimento, situação e centro de custo.
- Relatórios mensais com despesas por categoria e por centro de custo.
- Dados de cada conta filtrados no servidor pela sessão autenticada.
