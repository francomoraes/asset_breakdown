# Job de Snapshot Mensal de Patrimônio

Este job foi criado para salvar automaticamente o patrimônio total de cada usuário no primeiro dia de cada mês.

## Como Executar Manualmente

```bash
cd backend
npm run job:wealth-snapshot
```

## Configurar como Cron Job (Linux/Mac)

1. Abra o crontab:

```bash
crontab -e
```

2. Adicione a seguinte linha para executar todo dia 1 de cada mês à meia-noite:

```
0 0 1 * * cd /caminho/para/seu/projeto/backend && npm run job:wealth-snapshot >> /var/log/wealth-snapshot.log 2>&1
```

## Configurar como Task Scheduler (Windows)

1. Abra o **Agendador de Tarefas** (Task Scheduler)
2. Clique em **Criar Tarefa Básica**
3. Nome: "Snapshot Mensal de Patrimônio"
4. Gatilho: **Mensal**, dia 1, hora 00:00
5. Ação: **Iniciar um programa**
   - Programa: `cmd.exe`
   - Argumentos: `/c cd /d C:\caminho\para\seu\projeto\backend && npm run job:wealth-snapshot`

## O que o Job Faz

1. Conecta ao banco de dados
2. Busca todos os usuários
3. Para cada usuário:
   - Calcula o patrimônio total (soma de todos os ativos)
   - Salva um registro na tabela `wealth_history` com a data atual
4. Se já existe um registro para aquele mês, não cria duplicado
5. Registra logs de sucesso/erro

## Deployment em Produção

Para ambientes de produção, considere usar:

- **PM2** com cron: `pm2 start ecosystem.config.js --cron "0 0 1 * *"`
- **Node-cron** com integração no backend
- **Cloud Schedulers** (AWS EventBridge, Google Cloud Scheduler, etc.)
- **Heroku Scheduler**
- **Vercel Cron Jobs**
