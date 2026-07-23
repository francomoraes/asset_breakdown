# Job de Snapshot Mensal de Patrimônio

Este job foi criado para salvar automaticamente o patrimônio total de cada usuário no primeiro dia de cada mês.

## Como Executar Manualmente

```bash
cd backend
npm run job:wealth-snapshot
```

## Configurar localmente como Cron Job (Linux/Mac)

1. Abra o crontab:

```bash
crontab -e
```

2. Adicione a seguinte linha para executar todo dia 1 de cada mês à meia-noite:

```
0 0 1 * * cd /caminho/para/seu/projeto/backend && npm run job:wealth-snapshot >> /var/log/wealth-snapshot.log 2>&1
```

## Configurar localmente como Task Scheduler (Windows)

1. Abra o **Agendador de Tarefas** (Task Scheduler)
2. Clique em **Criar Tarefa Básica**
3. Nome: "Snapshot Mensal de Patrimônio"
4. Gatilho: **Mensal**, dia 1, hora 00:00
5. Ação: **Iniciar um programa**
   - Programa: `cmd.exe`
   - Argumentos: `/c cd /d C:\caminho\para\seu\projeto\backend && npm run job:wealth-snapshot`

## Deployment em Produção (Railway) — já configurado

O agendamento em produção roda como um **segundo serviço Railway** no mesmo projeto da API, configurado como Cron Job nativo (não um `node-cron` embutido no código). Passo a passo usado:

1. **New → GitHub Repo**, apontando pro mesmo repositório do backend.
2. **Settings → Source → Root Directory**: deixado vazio/padrão — o repo já é a raiz do backend, sem pasta `backend/` intermediária.
3. **Settings → Build**: Railpack default, sem build command customizado — ele já detecta o script `"build": "tsc && tsc-alias"` do `package.json` e roda sozinho.
4. **Settings → Deploy → Custom Start Command**:
   ```
   node dist/jobs/monthly-wealth-snapshot.js
   ```
   Sem `migration:run` — as migrations já rodam no deploy do serviço principal da API.
5. **Variables**: `DATABASE_URL` e `NODE_ENV` adicionadas como **referência** às mesmas variáveis do serviço principal da API (em vez de duplicar o valor), pra nunca ficarem dessincronizadas se a credencial do banco mudar.
6. **Cron Schedule** (aba "Cron Runs" ou em Settings → Deploy): `0 0 1 * *` (meia-noite UTC, todo dia 1 do mês).

Pra testar sem esperar o próximo mês, usa o botão **Run now** na aba "Cron Runs" — as execuções (com log) aparecem em "Recent Executions".

## O que o Job Faz

1. Conecta ao banco de dados
2. Busca todos os usuários
3. Para cada usuário:
   - Calcula o patrimônio total (soma de todos os ativos)
   - Salva um registro na tabela `wealth_history` com a data atual
4. Se já existe um registro para aquele mês, não cria duplicado
5. Registra logs de sucesso/erro
