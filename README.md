# freshdesk-ticket-bridge

App FDK que roda no Freshdesk do **cliente**. Observa `onTicketCreate`, `onTicketUpdate` e
`onConversationCreate`; quando um ticket bate com a categoria + campo autorizados pela
licença desta instalação, envia o evento (com a licença como credencial) pro middleware da
Nuria — que é implementação privada ([freshdesk-middleware](https://github.com/nuria-tech/freshdesk-middleware)),
não faz parte deste repositório (ver "Segurança e transparência" abaixo).

## O que este app NÃO faz

- Não lê nem envia tickets fora da categoria/campo que a licença autoriza.
- Não guarda nem expõe a API key do Freshdesk da Nuria — essa credencial nunca chega até aqui.
- Não decide sozinho o que é sincronizado: o middleware sempre revalida a categoria/campo (a
  partir dos claims assinados da própria licença, não do que este app diz) antes de espelhar
  qualquer coisa — defesa em profundidade, mesmo que este app seja modificado do lado do
  cliente.

## Segurança e transparência

Este repositório é público de propósito: para que o time técnico do cliente possa auditar
exatamente como o sync e o isolamento de dado funcionam, sem precisar confiar apenas na nossa
palavra. O middleware (a peça que fala com o Freshdesk da Nuria e guarda credenciais reais) é
um repositório **privado** à parte — o que importa pro cliente auditar é o que roda dentro do
próprio Freshdesk dele, que é justamente este código.

Pontos que valem revisar:

- **Nenhum segredo ou dado do cliente está hardcoded aqui.** A licença e a API key do
  Freshdesk do cliente são preenchidas na tela de instalação (`config/iparams.json`) e ficam
  criptografadas pela própria plataforma Freshdesk.
- **A licença é assinada pela Nuria** (claims: conta, categoria, campo, validade) — este app
  só decodifica pra filtrar localmente antes de mandar qualquer coisa pra fora; ele nunca
  verifica a assinatura (não tem, e não precisa ter, a chave pública). Quem verifica de
  verdade é sempre o middleware.
- **Uma licença de uma conta nunca serve pra outra** — o middleware confere isso a cada
  chamada, usando o `account_id` que o próprio Freshdesk já entrega no payload do evento (não
  é um valor que este app inventa ou que o cliente digita).
- **A API key do Freshdesk do cliente** só é usada para escrever a resposta de volta no
  ticket, quando um agente da Nuria responde do lado de lá — recomendamos criar um agente
  dedicado, restrito só à categoria usada aqui, em vez de reaproveitar uma key com acesso
  amplo.

## Configuração (iparams)

| Campo | O que é |
|---|---|
| `license` | Token assinado pela Nuria: conta, categoria, campo e validade autorizados |
| `client_freshdesk_api_key` | API key de um agente dedicado, usada só para a resposta de volta |

## Desenvolvimento local

```bash
pnpm install
pnpm dev     # fdk run
pnpm build   # fdk validate
```

> **Nota:** a chamada `$request.post(...)` em `server/modules/syncModule.js` precisa ser
> conferida contra a documentação oficial da versão do FDK instalada antes do primeiro deploy
> real — a API de request "full URL" (sem template no manifest) mudou entre versões do FDK.
