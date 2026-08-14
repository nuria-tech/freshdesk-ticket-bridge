// Decodifica (NÃO verifica assinatura) só pra ler os claims localmente e decidir se vale a
// pena mandar o evento pro middleware. A verificação de verdade (assinatura, conta) acontece
// sempre do lado do middleware — o app não tem, e não precisa ter, a chave pública. Não
// confiar cegamente nesses claims fora deste app é a razão da revalidação lá.
function decodeLicensePayload(licenseToken) {
  const parts = licenseToken.split('.');
  if (parts.length !== 3) {
    throw new Error('Iparam "license" não parece um token válido (esperado 3 partes separadas por ".")');
  }

  let json;
  try {
    json = Buffer.from(parts[1], 'base64url').toString('utf8');
    return JSON.parse(json);
  } catch (error) {
    throw new Error('Iparam "license" não decodifica como JSON válido: ' + error.message);
  }
}

exports = {
  decodeLicensePayload: decodeLicensePayload,
};
