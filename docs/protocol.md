# Formato de auditoria colmeia.audit.v1

Formato próprio documentado para a Alfa. Não é Nostr, ACP ou um formato declarado compatível com Buzz. A decisão de adotar um protocolo interoperável permanece aberta conforme a seção 16 do plano.

`scripts/protocol.mjs` define a serialização: JSON com chaves de objetos ordenadas lexicograficamente, arrays em ordem original, strings JSON, booleanos, null e inteiros seguros. Valores indefinidos, floats e tipos externos ao domínio são rejeitados. SHA-256 sobre UTF-8 canônico; assinaturas Ed25519 em Base64; chaves públicas PEM/SPKI.

Uma entrada contém sequência, identificador do espaço, hash anterior, instante em milissegundos, tipo, identidade, hash/referência do payload, hash da ação e autorização humana (quando agente). `entry_hash` é SHA-256 do corpo. `author_signature` assina o corpo canônico. O primeiro `prev_hash` é zero repetido 64 vezes.

O pacote exportado contém:

- `format`, `root_public_key`, `identities`, `entries`;
- `manifest`: espaço, sequência/cabeça, hash das identidades e instante da exportação;
- `manifest_signature`: assinatura do manifesto pela organização.

A verificação confere raiz confiável, manifesto, identidades, sequência/cadeia, hashes, assinatura do autor, revogação por sequência e cossinatura do proprietário humano. A cabeça assinada detecta truncamento do pacote. Falha retorna a primeira sequência problemática quando identificável.

## Confiança e limites

Um pacote que apresenta sua própria chave não prova quem é seu autor. A impressão digital confiável precisa ser obtida separadamente e passada ao CLI. A fingerprint é SHA-256 da representação Base64 do SPKI/DER da chave raiz. Preserve esse algoritmo ao implementar outro verificador.

Um pacote antigo íntegro continua íntegro. O verificador offline não prova que o pacote é o mais recente: compare a cabeça com uma âncora externa previamente guardada. Também não detecta um histórico inteiro reescrito por alguém com a chave raiz e todas as chaves de autoria necessárias. Não há timestamp de autoridade externa, testemunhas, consenso ou replicação.

Payloads não acompanham a auditoria. Sem o conteúdo original, o verificador demonstra integridade e vínculo de hashes/assinaturas, não veracidade editorial ou correção de uma alegação comercial. Revogação é avaliada conforme o registro de identidades autenticado pelo manifesto, não por consulta a um serviço online.

## Executar em ambiente limpo

Copie apenas `scripts/verify.mjs`, `scripts/protocol.mjs` e um pacote exportado. Com Node.js instalado:

```sh
node verify.mjs pacote.json fingerprint-recebida-separadamente
```

Retorno 0 significa cadeia verificada; 1 significa falha ou entrada inválida. Nenhuma dependência npm nem chamada de rede é necessária.
