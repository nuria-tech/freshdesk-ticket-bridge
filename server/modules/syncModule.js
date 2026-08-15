const config = require('../lib/config');
const decodeLicense = require('../lib/decodeLicense');

// Único critério de disparo: categoria E campo customizado batem com o que a própria licença
// autoriza (não é o app que decide isso — é o que a Nuria assinou). Qualquer ticket fora
// disso nunca sai desta função — a Nuria não fica sabendo que ele existe.
function matchesLicensedScope(ticket, license) {
  const categoryMatches = ticket.category === license.category;
  const fieldValue = ticket.custom_fields && ticket.custom_fields[license.fieldName];
  const fieldMatches = fieldValue === license.fieldValue;
  return categoryMatches && fieldMatches;
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
  await $request.post(config.MIDDLEWARE_ENDPOINT, {
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + payload.iparams.license,
      'X-Nuria-Client-Api-Key': payload.iparams.client_freshdesk_api_key,
    },
  });
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
