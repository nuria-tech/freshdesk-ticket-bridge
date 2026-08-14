// Endpoint público do middleware da Nuria (não é segredo — a segurança está na verificação
// da licença assinada em cada request, não em esconder essa URL). O que É segredo (a licença,
// a API key do cliente) vem sempre de iparams, nunca daqui. Domínio genérico de propósito —
// mesmo host serve pra outras integrações futuras (outros clientes/fornecedores), não é
// exclusivo deste app.
const MIDDLEWARE_ENDPOINT = 'https://ms-freshdesk.nuria.com.br/sync';

exports = {
  MIDDLEWARE_ENDPOINT: MIDDLEWARE_ENDPOINT,
};
