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

2. Copie `.env.example` para `.env` e configure `DATABASE_URL` e `SESSION_SECRET`. Para enviar convites, configure também `RESEND_API_KEY`, `RESEND_FROM_EMAIL` e `NEXT_PUBLIC_APP_URL`.

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

Para habilitar convites da equipe, crie uma chave de API no [Resend](https://resend.com), verifique o domínio do remetente e configure `RESEND_API_KEY` e `RESEND_FROM_EMAIL`. O endereço em `RESEND_FROM_EMAIL` precisa pertencer a um domínio autorizado no Resend. Defina `NEXT_PUBLIC_APP_URL` como o endereço público do aplicativo (por exemplo, `https://anhanguera-financia.vercel.app`) para que os links dos convites apontem para a implantação correta. Não publique nem compartilhe a chave de API.

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
- Espaços de empresa separados, com troca entre empresas das quais o usuário faça parte.
- Equipe por empresa, convites por e-mail e perfis Administrador, Financeiro e Somente leitura. Administradores gerenciam a empresa e os acessos; perfis Financeiro podem operar lançamentos; Somente leitura consulta os dados.
