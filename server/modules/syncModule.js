const config = require('../lib/config');
const decodeLicense = require('../lib/decodeLicense');

// Único critério de disparo: o campo customizado bate com o que a própria licença autoriza
// (não é o app que decide isso — é o que a Nuria assinou). Qualquer ticket fora disso nunca
// sai desta função — a Nuria não fica sabendo que ele existe.
//
// "categoria" (license.category) NÃO é critério de escopo, só metadado da licença — Freshdesk
// tem um campo "Category" livre, mas Freshservice usa "Type" com valores fixos do próprio ITSM
// (Incident/Service Request/Problem/Change), que o cliente não pode renomear pra um valor
// customizado da Nuria. O campo customizado, ao contrário, existe do mesmo jeito nos dois
// produtos com qualquer valor — por isso é o único critério realmente portátil.
function matchesLicensedScope(ticket, license) {
  const fieldValue = ticket.custom_fields && ticket.custom_fields[license.fieldName];

  // LOG TEMPORÁRIO — remover depois que o teste real de amanhã confirmar o formato do campo
  // customizado no Freshservice do cliente. Loga só as CHAVES de custom_fields (schema, não
  // dado sensível) e o tipo do valor encontrado — nunca o valor em si, que pode ser algo
  // específico do ticket do cliente.
  console.log(
    '[TEMP-DEBUG matchesLicensedScope] fieldName esperado=' + license.fieldName +
    ' | chaves em custom_fields=' + (ticket.custom_fields ? JSON.stringify(Object.keys(ticket.custom_fields)) : 'null') +
    ' | tipo do valor encontrado=' + typeof fieldValue +
    ' | bateu=' + (fieldValue === license.fieldValue)
  );

  return fieldValue === license.fieldValue;
}

// Platform-version 3.0 não traz mais `payload.domain`/`payload.account_id` direto — o app é
// "global" (declara os módulos support_ticket E service_ticket, pra instalar tanto em
// Freshdesk quanto em Freshservice), e o host de origem vem em
// `currentHost.endpoint_urls.<produto>` como URL completa (ex.: "https://acme.freshdesk.com"),
// chaveado pelo produto onde o app está rodando nessa instalação. Extrai só o hostname.
//
// NOTE: `org_domain` (mais direto) existe na doc, mas só na tela de instalação/config — não
// aparece no payload de evento serverless. E o payload de teste local (`server/test_data`)
// pode não simular `currentHost` do mesmo jeito que o runtime real — conferir com `fdk run`
// contra a instalação real antes de confiar nisso em produção.
function extractDomain(payload) {
  // LOG TEMPORÁRIO — remover depois que o teste real de amanhã confirmar o shape de
  // currentHost. `currentHost` é metadado técnico da instalação (URLs de host, não dado de
  // paciente/ticket), então é seguro logar bruto pra comparar com o que a doc descreve.
  console.log('[TEMP-DEBUG extractDomain] payload.currentHost=' + JSON.stringify(payload.currentHost));

  const endpointUrls = payload.currentHost && payload.currentHost.endpoint_urls;
  const rawUrl = endpointUrls && (endpointUrls.freshdesk || endpointUrls.freshservice);
  if (!rawUrl) {
    throw new Error('Não encontrei currentHost.endpoint_urls.freshdesk nem .freshservice no payload do evento');
  }
  return rawUrl.replace(/^https?:\/\//, '');
}

async function sendToMiddleware(eventType, ticket, conversation, payload) {
  const body = {
    domain: extractDomain(payload),
    eventType: eventType,
    clientTicketId: ticket.id,
    ticket: ticket,
    conversation: conversation || null,
  };

  // NOTE: verificar a assinatura exata de $request na versão do FDK instalada (platform-version /
  // fdk podem mudar essa API entre releases) antes do primeiro deploy real.
  //
  // LOG TEMPORÁRIO — remover depois que o teste real de amanhã confirmar a assinatura. Se
  // $request.post não existir ou tiver outra assinatura nessa versão do FDK, o erro real vai
  // aparecer no console.error(error) do server.js — este log só ajuda a situar ONDE isso
  // aconteceu (endpoint chamado + que a função existe no runtime real).
  console.log(
    '[TEMP-DEBUG sendToMiddleware] chamando $request.post, endpoint=' + config.MIDDLEWARE_ENDPOINT +
    ' | typeof $request.post=' + typeof $request.post
  );

  const response = await $request.post(config.MIDDLEWARE_ENDPOINT, {
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + payload.iparams.license,
      'X-Nuria-Client-Api-Key': payload.iparams.client_freshdesk_api_key,
    },
  });

  // LOG TEMPORÁRIO — remover junto com o de cima. Confirma o shape do retorno de $request.post
  // (ex.: response.status existe? é number ou string?) sem logar o corpo da resposta.
  console.log(
    '[TEMP-DEBUG sendToMiddleware] $request.post retornou | chaves=' +
    (response ? JSON.stringify(Object.keys(response)) : 'null') +
    ' | status=' + (response && response.status)
  );
}

async function onTicketEvent(eventType, payload) {
  const license = decodeLicense.decodeLicensePayload(payload.iparams.license);
  const ticket = payload.data.ticket;

  if (!matchesLicensedScope(ticket, license)) {
    return;
  }

  await sendToMiddleware(eventType, ticket, null, payload);
}

async function onConversationEvent(payload) {
  // LOG TEMPORÁRIO — remover depois que o teste real de amanhã confirmar que
  // onConversationCreate dispara de fato sob o módulo service_ticket no Freshservice (não
  // documentado oficialmente). Só confirma que o handler foi chamado; nada de conteúdo de
  // ticket/conversa aqui.
  console.log('[TEMP-DEBUG onConversationEvent] handler disparou');

  const license = decodeLicense.decodeLicensePayload(payload.iparams.license);
  const ticket = payload.data.ticket;
  const conversation = payload.data.conversation;

  if (!matchesLicensedScope(ticket, license)) {
    return;
  }

  await sendToMiddleware('onConversationCreate', ticket, conversation, payload);
}

exports = {
  matchesLicensedScope: matchesLicensedScope,
  extractDomain: extractDomain,
  onTicketEvent: onTicketEvent,
  onConversationEvent: onConversationEvent,
};
