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

2. Copie `.env.example` para `.env` e configure `DATABASE_URL`, `SESSION_SECRET` e `DATA_ENCRYPTION_KEY`.

3. Crie/atualize as tabelas do banco conforme o schema:

   ```bash
   npx prisma db push
   npx prisma generate
   ```

4. Inicie o ambiente de desenvolvimento:

   ```bash
   npm run dev
   ```

5. Acesse [http://localhost:3000](http://localhost:3000), crie uma conta como empresa ou pessoa física e comece a registrar lançamentos.

`SESSION_SECRET` deve ser uma chave aleatória com pelo menos 32 caracteres. `DATA_ENCRYPTION_KEY` deve ser uma chave Base64 canônica de exatamente 32 bytes; gere-a localmente com:

```bash
node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('base64'))"
```

Guarde uma cópia segura da chave de cifragem. Perder ou trocar a chave pode tornar irrecuperáveis os dados pessoais cifrados. Nunca a compartilhe pelo chat nem a salve no Git.

## Publicação na Vercel

- Configure `DATABASE_URL` para o banco PostgreSQL de produção, `SESSION_SECRET` como uma chave aleatória própria com pelo menos 32 caracteres e `DATA_ENCRYPTION_KEY` como Secret no ambiente Production. Não use valores de exemplo nem publique segredos no Git.
- O build de produção aplica as migrações e cifra os dados pessoais existentes antes de compilar o Next.js. Mantenha um backup restaurável do banco e preserve a chave de cifragem.
- O Prisma Client é gerado durante a instalação das dependências.
- Após configurar as variáveis e confirmar o backup, publique uma nova implantação de produção.

## Funcionalidades

- Cadastro e login com sessão em cookie `HttpOnly`; o cadastro permite escolher entre empresa e uso pessoal.
- Lançamentos de receitas e despesas com categorias livres, vencimentos, situação e centros de custo.
- Contas pendentes a pagar e a receber, com baixa rápida após pagamento ou recebimento.
- Painel de fluxo de caixa mensal com valores realizados e saldo projetado.
- Página de contas a pagar e receber com filtros por situação e tipo, vencimentos e baixa rápida.
- Análise dedicada de centros de custo com despesas agrupadas por área, categoria ou projeto.
- Busca, filtros, edição, exclusão e exportação CSV com vencimento, situação e centro de custo.
- Relatórios mensais com despesas por categoria e por centro de custo.
- Dados de cada conta filtrados no servidor pela sessão autenticada.
- Espaços de empresa separados, com troca entre empresas das quais o usuário faça parte.
- Gestão da equipe empresarial com perfis Administrador, Financeiro e Somente leitura. Administradores gerenciam a empresa e os acessos; Financeiro pode operar lançamentos; Somente leitura consulta os dados.
