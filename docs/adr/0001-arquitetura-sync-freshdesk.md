# ADR 0001 — Arquitetura de sync de tickets entre Freshdesk do cliente e Freshdesk da Nuria

- **Status:** proposto
- **Data:** 2026-07-29

## Contexto

Um cliente Nuria usa Freshdesk para o próprio suporte e quer que tickets criados numa
categoria/campo específico apareçam também no Freshdesk da Nuria, com as conversas
sincronizadas nos dois sentidos. Requisito não-negociável do cliente: nenhum dos dois lados
pode ler ou escrever fora do que está explicitamente vinculado por aquela categoria/campo —
nem a Nuria enxerga tickets do cliente fora do escopo combinado, nem o cliente ganha acesso a
tickets internos da Nuria.

Ponto de partida técnico: a API do Freshdesk não tem controle de acesso granular por
categoria/campo — uma API key é válida pra conta inteira. Isso significa que o isolamento
**não pode** ser delegado ao Freshdesk; tem que ser reforçado por uma camada própria.

## Decisão

Dois componentes, com responsabilidades e nível de confiança bem separados — e em dois
repositórios diferentes (ver "Por que este repositório é público", abaixo):

### 1. Este app FDK — roda na conta do cliente

- Instalado no Freshdesk do **cliente**. Toda configuração específica (a licença e a API key
  do cliente) é preenchida na tela de instalação (`iparams`), **nunca hardcoded no código**.
  O Freshdesk criptografa esses valores automaticamente.
- Escuta `onTicketCreate` / `onTicketUpdate` / `onConversationCreate`. Decodifica (sem
  verificar assinatura — não precisa) a licença pra filtrar localmente por categoria/campo, e
  só então envia o evento pro middleware, usando a licença como credencial (Bearer).
- Não guarda estado. Não tem acesso direto ao Freshdesk da Nuria, nem à chave privada que
  assina as licenças.

### 2. Middleware de sync — privado, roda na AWS da Nuria

- Implementação interna (repositório privado à parte — este repo não contém o código dele).
  Recebe o evento assinado, **revalida** categoria/campo contra os claims da própria licença
  (defesa em profundidade: não confia cegamente no filtro que já rodou do lado do app, porque
  o app roda em ambiente que o cliente controla), mantém o mapeamento de tickets, e é o único
  lugar que guarda a credencial do Freshdesk da Nuria e a chave privada de assinatura.
- Sincroniza conversa **como nota/resposta**, não o ticket inteiro — evita vazar campo interno
  de um lado pro outro.

### Por que dois componentes (e dois repositórios)

Este app sozinho não consegue guardar com segurança a credencial do **outro** lado nem manter
um mapeamento durável e auditável. Separar em middleware permite: reforçar a validação numa
camada que o cliente não controla, manter as duas credenciais isoladas uma da outra, e auditar
cada sync. E como o middleware guarda credenciais e detalhes de infraestrutura da Nuria, ele
vive num repositório privado — só o que o cliente instala no próprio Freshdesk (este repo)
precisa ser público.

## Modelo de segurança / isolamento

- **Nenhum hardcode de cliente, domínio ou segredo neste repositório** — tudo entra via
  `iparams`, preenchidos pelo cliente na instalação.
- **A licença é a fonte de identidade/escopo, não de autorização em tempo real**: assinada
  pela Nuria (domínio, categoria, campo — sem prazo de validade), verificada pelo middleware a
  cada chamada — uma licença de um domínio nunca serve pra outro, mesmo que alguém tente
  reenviar/reaproveitar o token. Se um cliente pode sincronizar **agora** é decidido do lado
  da Nuria (revogável a qualquer momento), não pela licença em si.
- **O identificador é o `domain`, não um `account_id`**: o `domain` vem do próprio Freshdesk
  (presente de graça em todo payload de evento) e é o que o cliente consegue informar durante
  o onboarding — lê direto na própria URL. O `account_id` do Freshdesk é um identificador
  interno opaco; o cliente não teria como sequer descobrir esse valor pra passar à Nuria.
- **Allowlist de categoria/campo revalidado no middleware** — mesmo que este app seja
  modificado do lado do cliente, o middleware não replica nada fora do escopo autorizado pela
  licença.
- **Credenciais nunca cruzam de lado**: este app nunca vê a API key da Nuria nem a chave
  privada de assinatura; o middleware nunca expõe a API key do cliente de volta pro Freshdesk
  do cliente além do uso estrito de responder no ticket certo.
- **LGPD**: os tickets sincronizados podem conter dado de paciente do cliente. Antes de ligar
  isso em produção para um cliente real, confirmar com jurídico/DPO se há contrato/DPA
  cobrindo o tratamento desse dado pela Nuria como operadora, e minimizar o que é replicado
  (só o necessário para o atendimento, não o ticket completo).

## Por que este repositório é público

O cliente pediu para poder auditar como o sync e o isolamento funcionam. Por isso:

- O código aqui é **genérico e parametrizado** — só chama endpoints documentados da API
  pública do Freshdesk, nunca contém nome de cliente, domínio real, categoria/campo real ou
  qualquer segredo.
- O que importa pro cliente auditar é justamente o que roda **dentro do Freshdesk dele** — que
  é este repositório. O middleware (credenciais reais, infraestrutura da Nuria) fica num
  repositório privado à parte.
- Isso é uma exceção à convenção da org `nuria-tech` (os demais repos são privados) —
  decisão deliberada para dar transparência ao cliente sobre o modelo de segurança, não um
  padrão a repetir sem essa mesma justificativa.

## Sobre o endpoint do middleware ser genérico

`server/lib/config.js` aponta pra `ms-freshdesk.nuria.com.br` — um domínio deliberadamente
genérico, não específico deste cliente. A ideia é que o mesmo middleware (e talvez, no
futuro, o mesmo padrão de app) sirva outras integrações de ticketing da Nuria, não só esta.

## Cliente real é Freshservice, não Freshdesk (descoberto em 2026-08-14)

O cliente deste projeto usa **Freshservice**, não Freshdesk — apesar do nome do repositório
(nome/domínio real do cliente não vai neste repo público de propósito; ver ADR do middleware,
privado, pra esse detalhe). O middleware recebeu o fix correspondente (`domain` como hostname
completo, não mais um sufixo `.freshdesk.com` assumido) — ver ADR do middleware pros detalhes.

**Corrigido em 2026-08-19** (bloqueava o primeiro teste real): `server/modules/syncModule.js`
comparava `ticket.category` — campo que nunca existiu de verdade em Freshservice (usa "Type",
valores fixos do próprio ITSM — Incident/Service Request/Problem/Change —, não uma categoria
livre que o cliente possa renomear pra um valor da Nuria). `category` continua na licença, mas
só como metadado, nunca mais enforçado.

**Revisado ainda em 2026-08-19 (mesmo dia, rodada seguinte):** o critério de escopo que
substituiu categoria passou por mais duas iterações no mesmo dia — primeiro campo customizado
(`fieldName`/`fieldValue`), depois cogitou-se tag, e por fim **grupo/fila** (`group_id`), que é
o que ficou. Motivo: tanto campo customizado quanto tag exigem alguma ação do lado do cliente
(criar um campo, ou marcar cada ticket) — o cliente real deste projeto já tem um grupo/fila no
Freshservice deles pra onde os tickets relevantes já são roteados, então usar `group_id` (campo
padrão, presente em todo ticket) elimina qualquer ação nova, única ou por ticket. Ver ADR do
middleware, seção "Critério de escopo: de campo customizado, pra tag, pra grupo/fila", pro
histórico completo da decisão. `matchesLicensedScope` hoje compara `ticket.group_id ===
license.groupId`.

## Migração pra platform-version 3.0 — app global (2026-08-14)

Decisão: em vez de manter o app específico de um produto (o que exigiria um segundo
pacote/manifest pra qualquer cliente futuro em Freshdesk), migramos pra platform-version
**3.0**, que suporta apps "globais" — uma única instalação funciona em múltiplos produtos
Freshworks.

- **`manifest.json`**: `"product"` → `"modules"`, com `common` (vazio, reservado pra eventos
  tipo `onAppInstall` se algum dia precisarmos) + `support_ticket` (Freshdesk) +
  `service_ticket` (Freshservice) — os dois com os mesmos três handlers
  (`onTicketCreate`/`onTicketUpdate`/`onConversationCreate`), já que a lógica de negócio é
  agnóstica de produto.
- **`config/iparams.json`**: cada campo ganhou `"modules": ["support_ticket", "service_ticket"]`
  — sem isso, o campo só aparece condicionado a um módulo específico.
- **Breaking change de payload, o mais importante**: `payload.domain`/`payload.account_id`
  (usados até aqui) **não existem mais** em platform-version 3.0. No lugar, o payload traz
  `currentHost.endpoint_urls.<produto>` como uma **URL completa** (ex.:
  `"https://acme.freshservice.com"`, confirmado num exemplo real da doc oficial — não é só o
  hostname). `server/modules/syncModule.js` ganhou `extractDomain(payload)`, que lê
  `currentHost.endpoint_urls.freshdesk || currentHost.endpoint_urls.freshservice` e tira o
  `https://` na mão.
- **Não confirmado, verificar com teste real**: a doc explicitamente diz que o payload de
  simulação local (`server/test_data/*.json`, `fdk run`) pode não simular `currentHost` do
  mesmo jeito que o runtime real — os valores de módulo/URL/domínio na simulação local vêm de
  configuração separada (tela de settings do `fdk run`), não necessariamente do JSON do
  arquivo de teste. Os fixtures aqui foram atualizados pra incluir `currentHost` no formato
  confirmado, mas **isso precisa ser validado rodando `fdk run` de verdade** antes de confiar
  no comportamento em produção.

## Pendências conhecidas

- Verificar a assinatura exata de `$request.post(...)` (chamada "full URL", sem template no
  manifest) contra a documentação oficial da versão do FDK instalada antes do primeiro deploy
  real — essa API mudou entre versões do FDK.
- Recomendar/documentar pro cliente a criação de um agente dedicado (restrito só à
  categoria/tipo usado aqui) pra gerar a `client_freshdesk_api_key`, em vez de reaproveitar uma
  key com acesso amplo.
- Validar `extractDomain(payload)` e o shape de `currentHost` com `fdk run`/instalação real
  (ver seção "Migração pra platform-version 3.0" acima) — não confiar só na doc.
- `onConversationCreate` sob o módulo `service_ticket` não confirmado na doc pública —
  testar antes do primeiro deploy real.
- FDK `9.0.5` fixado no `manifest.json` — confirmar que essa versão suporta platform-version
  3.0 de verdade (a doc menciona FDK 9.7.0+ como o que já escala apps globais por padrão; não
  testamos se 9.0.5 funciona igual).
- **Bug encontrado e corrigido (2026-08-15)**: `package.json` tinha `"fdk-cli": "9.0.5"` como
  devDependency — não existe esse pacote no npm público (só existe uma versão placeholder
  `0.0.0-0.0.3` de outro autor). Instalação real é
  `npm install https://cdn.freshdev.io/fdk/latest.tgz -g` (ferramenta global, não dependência
  de projeto) — documentado no README. **Confirmado que o FDK CLI exige Node 18.x
  especificamente** (recusa rodar em Node 20+/22+/24+) — quem for testar localmente precisa de
  um Node 18.x dedicado (ex. via `nvm install 18.18.2`), sem afetar o Node usado pra outros
  projetos. Não confirmamos se o tarball "latest" corresponde à versão `9.0.5` fixada no
  manifest — só existe instalação de "latest" pelo método documentado, não uma versão
  específica pinada.
- **Bug encontrado e corrigido (2026-08-19)**: `server/test_data/*.json` simulavam uma licença
  com claims antigos (`accountId`, `exp`) — schema anterior à revisão que amarrou a licença a
  `domain` e removeu expiração. Regenerados com o schema atual (`domain`, `category`,
  `fieldName`, `fieldValue`, sem `exp`) — sem isso, qualquer teste local rodado com esses
  arquivos não refletia o contrato real de licença. Os tickets de exemplo também trocaram
  `"category"` por `"type"` (mais fiel a um payload real de Freshservice), já que categoria
  deixou de ser critério de escopo (ver seção acima).
