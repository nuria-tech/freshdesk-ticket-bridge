# AGENTS.md

App FDK público que roda no Freshdesk de clientes da Nuria, sincronizando tickets de uma
categoria/campo específico com o Freshdesk da Nuria. É a metade **auditável pelo cliente**
de um sistema de duas partes — a outra metade (middleware, credenciais reais) vive em
[freshdesk-middleware](https://github.com/nuria-tech/freshdesk-middleware),
privado. Ver [ADR 0001](docs/adr/0001-arquitetura-sync-freshdesk.md) para o desenho completo.

## Estrutura

```
manifest.json           Manifesto FDK (eventos, versão de plataforma)
config/
  iparams.json          Campos de instalação: license, client_freshdesk_api_key
  iparam_test_data.json Valores de teste (licença fake, nunca usar em produção)
server/
  server.js             Handlers dos eventos (onTicketCreate/Update, onConversationCreate)
  lib/
    config.js            Endpoint do middleware (público, não é segredo)
    decodeLicense.js      Decodifica (NÃO verifica) a licença pra filtro local
  modules/
    syncModule.js         Filtra por categoria/campo da licença e envia pro middleware
  test_data/*.json        Fixtures de evento pra `fdk test`
```

## Rodando localmente

```bash
pnpm install
pnpm dev     # fdk run
pnpm build   # fdk validate
pnpm test    # fdk test
pnpm lint
```

## Convenções deste repositório

- **Nunca hardcode segredo, domínio ou nome de cliente real** — este repo é público. Tudo
  específico de uma instalação entra via `iparams`.
- **Este app nunca verifica a assinatura da licença** — só decodifica pra pré-filtrar. Quem
  verifica de verdade é sempre o middleware (repo privado). Não "corrija" isso adicionando
  verificação de assinatura aqui — não tem, e não deve ter, a chave pública/privada de
  propósito (o objetivo é manter a fronteira de confiança do lado do middleware).
- **A chamada `$request.post(...)` em `syncModule.js` não foi validada contra o FDK real** —
  conferir a assinatura exata na documentação da versão instalada antes do primeiro deploy.

## Nunca fazer aqui

- Nunca commitar uma licença real, API key real, ou domínio real de cliente — só os fakes de
  `iparam_test_data.json`/`test_data/*.json`.
- Nunca mover lógica do middleware (mapeamento de ticket, credencial da Nuria, emissão de
  licença) pra este repositório — ele é deliberadamente público e fino.
