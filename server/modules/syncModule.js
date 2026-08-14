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

async function sendToMiddleware(eventType, ticket, conversation, payload) {
  const body = {
    domain: payload.domain,
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
  onTicketEvent: onTicketEvent,
  onConversationEvent: onConversationEvent,
};
