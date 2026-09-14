# Revisão de lançamento — LocalNeuron 0.23.0

Revisão de 13 de setembro de 2026, em Mac Apple Silicon com 24 GiB de RAM e macOS 26.6.2.

**Resultado: alfa pública para testes. Ainda não homologada para lançamento comercial amplo.** Não foi possível validar todos os modelos, sistemas operacionais e combinações de hardware. O domínio próprio ainda precisa ser informado pelo proprietário.

## Correções aplicadas

- Atualizado `fflate` de 0.8.2 para 0.8.3, corrigindo travamento na leitura de ZIP64 malformado.
- Atualizado `uuid`, usado por ExcelJS, para 11.1.1 com suporte CommonJS. Importação/exportação e formatação condicional de planilha verificadas, sem retroceder a versão do ExcelJS.
- O site respeita `If-Range`: quando o arquivo mudou, retorna o arquivo completo, sem misturar partes antigas na retomada. Respostas condicionais com `If-None-Match` retornam 304.
- HTML, JavaScript e CSS do site exigem revalidação, reduzindo o risco de exibir interface antiga depois de uma atualização.
- Novos pacotes Mac DMG, Windows ZIP e Linux TAR.GZ gerados com as correções. A assinatura do Mac continua ad hoc.

## Evidências desta revisão

| Fluxo | Resultado e limite |
| --- | --- |
| Testes do aplicativo | 112 passaram após as correções; incluem sessão, origem, cofre, ferramentas, chat, downloads/retomada/hash, Pro e integração EXO simulada. |
| Testes do site | 7 passaram, incluindo idiomas, disponibilidade, autorização de upload e download parcial/condicional. |
| Chat local | Qwen3-0.6B GGUF respondeu `17 + 25 = 42` na interface, com pesquisa na internet desligada. Não usa resposta simulada. |
| Minha API | Resposta real `3 + 4 = 7` com chave; requisição sem chave recusada com 401. Verificada em loopback, não em outro computador. |
| Voz | Whisper small reconheceu a fala sintética em inglês sobre IA local. Não equivale a homologação de diferentes microfones, ruído ou sotaques. |
| Imagem | Stable Diffusion 1.5 produziu PNG 512 × 512 em quatro passos. Antes, a proteção de RAM recusou corretamente a execução sem memória suficiente. Quatro passos servem ao teste funcional, não à avaliação de qualidade final. |
| Vídeo | Wan 2.1 concluiu geração local curta no perfil experimental. Não equivale a edição e exportação de um projeto longo de produção. |
| EXO real | Runtime oficial 1.0.71 iniciou com modo offline e reconheceu um nó e sua memória. Nenhuma geração distribuída entre duas máquinas físicas foi validada. |
| Navegação | Chat, EXO e Estúdio abriram sem erros JavaScript capturados. Bloqueio/desbloqueio funcionou no workspace de teste. |
| Site móvel | Inglês selecionado, viewport 390 px, conteúdo 390 px, sem imagens quebradas. Links dos três sistemas disponíveis na versão pública anterior à atualização. |
| Pacotes | Conteúdo executável dos três pacotes comparado ao código; sem dados do usuário. DMG montado e assinatura estrutural verificada, com atalho Aplicativos e configuração pública sem licença de teste. |
| Preservação | 1.005 arquivos do workspace comparados após substituir o aplicativo e antes de reabri-lo, sem alterações. Pro local verificado criptograficamente e preservado. |

Os registros técnicos e amostras ficam em `work/release-audit/` na raiz do workspace. Não publicar esse diretório: contém dados fictícios de teste e cópia da configuração pública local do proprietário. Os pacotes públicos não incluem esse conteúdo.

## Pendências para lançamento comercial

1. **Distribuição Apple:** nenhum certificado válido de assinatura de código foi encontrado no chaveiro. Providenciar Developer ID, assinatura de distribuição, notarização e teste em Mac limpo. A verificação `codesign` ad hoc não confirma aceitação pelo Gatekeeper. [Documentação Apple](https://developer.apple.com/developer-id/).
2. **Windows e Linux:** pacotes montados no Mac e conferidos como arquivos, mas não executados nativamente nesta revisão. Validar instalação, dependências de runtime, drivers, áudio, modelos, encerramento e atualização em cada sistema.
3. **EXO:** testar duas máquinas reais, download completo, primeira resposta, queda/reentrada de um nó, liberação de memória e modo offline com pesos já instalados. A identificação da rede não é autenticação; usar rede privada confiável. A integração simulada não substitui esses testes.
4. **Pro comercial:** os pacotes públicos não têm serviço de cobrança nem chave pública de produção configurados. O teste local de Pro foi preservado; checkout, renovação, cancelamento e recuperação de pagamento reais continuam pendentes.
5. **Dependência sem correção publicada:** `npm audit --omit=dev` passou de cinco para dois alertas altos: `image-size` e seu dependente `pptxgenjs`. São alertas relacionados à mesma cadeia de dependência, não dois recursos do app quebrados. O exportador atual cria apresentações de texto e não oferece importação de imagens por essa biblioteca; não foi encontrado carregamento de `image-size` no bundle Node do PptxGenJS 4.0.1. Isso reduz a exposição observada, mas não remove a dependência vulnerável. Atualizar/substituir a cadeia ou formalizar a avaliação de risco antes de declarar uma versão estável. [Aviso ICNS](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr), [aviso JXL/HEIF](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq).
6. **Catálogo e qualidade:** acesso a metadados/links e arquitetura declarada não garantem execução. Não houve download e inferência de cada modelo catalogado. Modelos grandes precisam do hardware correspondente; licenças, autenticação e restrições variam por repositório. Voz, vídeo, exportações longas e recuperação após interrupções exigem matriz adicional de testes.

O cofre protege chaves; as conversas ficam no banco local sem criptografia, como informado na interface. Não anunciar criptografia de todo o conteúdo. A revisão não constitui auditoria independente de segurança nem garantia de ausência de falhas.
