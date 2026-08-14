// Decodifica (NÃO verifica assinatura) só pra ler os claims localmente e decidir se vale a
// pena mandar o evento pro middleware. A verificação de verdade (assinatura, expiração,
// conta) acontece sempre do lado do middleware — o app não tem, e não precisa ter, a chave
// pública. Não confiar cegamente nesses claims fora deste app é a razão da revalidação lá.
function decodeLicensePayload(licenseToken) {
  const payloadSegment = licenseToken.split('.')[1];
  const json = Buffer.from(payloadSegment, 'base64url').toString('utf8');
  return JSON.parse(json);
}

exports = {
  decodeLicensePayload: decodeLicensePayload,
};
