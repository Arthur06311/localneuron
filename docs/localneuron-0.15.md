# LocalNeuron 0.15 · Biblioteca e acesso

A biblioteca passou de 579 para **661 versões GGUF** (660 repositórios, 987 arquivos). O contador inclui versões e quantizações, não famílias distintas. A pesquisa global permite encontrar outros modelos; há 51 publicadores no seletor e entrada direta de `publicador/repositório`.

## Para baixar

1. Abra **Modelos**. Use **Acesso público** para filtrar arquivos verificados e **Motor compatível** para arquiteturas declaradas pelo llama.cpp integrado.
2. Compare download, RAM estimada e espaço disponível. **Baixar** verifica novamente os metadados e o acesso a cada arquivo antes de transferir. O SHA-256 é conferido depois.
3. **Pausar download** preserva os arquivos parciais. **Continuar download** verifica o prefixo, retoma por HTTP Range e confere o hash final. Partes já completas não são baixadas novamente. Se a origem não aceitar Range, o arquivo atual reinicia.
4. Para outra quantização, abra **Explorar Hugging Face**, pesquise ou informe o repositório. **Ver versões** mostra Q4, Q8, BF16 e outras variantes completas com tamanho, RAM e número de partes.

## Quando o Hugging Face pede login

A ficha original pode exigir autorização do publicador, mesmo quando a conversão GGUF indicada pelo catálogo é pública. Não é uma conta do LocalNeuron nem uma assinatura Pro.

Em **Acesso ao Hugging Face**, conecte um token de leitura de sua conta. O app valida a conta e guarda a credencial com AES-256-GCM, usando uma chave derivada do cofre local. Nenhum token aparece no catálogo ou nos logs, e o bearer só é enviado à origem HTTPS exata do Hugging Face, nunca a seus redirecionamentos CDN. O cofre bloqueado impede o acesso. Desconectar remove a credencial; pause downloads antes de desconectar.

Modelos restritos ainda exigem que o próprio usuário aceite a licença e obtenha aprovação. Um token não remove essa exigência. Repositórios privados não são importados nesta versão. Recursos básicos da biblioteca e essa conexão são gratuitos.

Documentação oficial: [modelos restritos](https://huggingface.co/docs/hub/models-gated), [tokens de acesso](https://huggingface.co/docs/hub/security-tokens).

## Modelos grandes e motores

Entre as adições estão versões das famílias Qwen, DeepSeek, Llama, Mistral, Gemma, Nemotron e Kimi. Kimi K2.5 BF16 soma **2.053.155.814.752 bytes**, aproximadamente **2,05 TB em disco**, distribuídos em 46 partes. Sua estimativa conservadora de memória é 2.392 GiB para contexto curto; não é uma medição. Q4 é uma quantização e não indica automaticamente 2 TB de RAM.

Cinco integrações locais são mostradas com disponibilidade por pacote: llama.cpp para GGUF, MLX/MLX LM no Apple Silicon, whisper.cpp para os perfis de transcrição, stable-diffusion.cpp para SD 1.5/Wan 2.1 e sherpa-onnx/Piper para o perfil Faber. Os motores não foram substituídos nesta versão. O motor GGUF está fixado em b10809; suas 149 arquiteturas declaradas são verificadas contra a fonte dessa revisão.

Arquitetura declarada não garante funcionamento de todas as quantizações, recursos multimodais ou qualidade. Seis entradas são sinalizadas como indisponíveis para o chat: granite-embedding-107m-multilingual, nomic-embed-code, Inkling-Small, Inkling, GLM-5.3-Flash e diffusiongemma-26B-A4B-it. Algumas são modelos de busca, outras exigem arquitetura ainda não integrada. As referências de mídia sem perfil instalado são identificadas como externas. Não existe suporte a todo repositório do Hugging Face; pesos fechados, como os do serviço ChatGPT, não ficam disponíveis para download por serem listados numa busca.

## Evidência e limites

- Auditoria final de 2026-09-13 UTC: todas as 661 versões tiveram revisão, tamanhos e hashes comparados com metadados públicos fixados; os 987 arquivos responderam a HEAD sem autenticação. Redirecionamentos na origem foram aceitos como acesso disponível. [Relatório completo](catalog-access.json).
- A conexão com conta autorizada foi testada com respostas simuladas; nenhuma credencial real do usuário foi usada para baixar modelos restritos.
- Essa auditoria não baixou os 987 arquivos nem executou todos os modelos. Os arquivos gigantes não foram transferidos ou carregados no Mac de 24 GiB.
- 96 testes automatizados passaram, incluindo criptografia, bloqueio, remoção de credencial durante validação, ausência de bearer em CDN, variantes divididas, integridade e retomada.
- Download real de SmolLM2-135M-Instruct (105.454.432 bytes), pausa em 34.919.380 bytes, retomada, SHA-256, instalação e resposta completa com llama.cpp no Mac. Internet do chat desabilitada; o teste verifica o funcionamento, não a qualidade do modelo.
- Interface conferida no navegador em modo escuro e claro, desktop e 390 px, sem transbordamento horizontal. Consulta real do Gemma mostrou a explicação de autorização; Kimi mostrou 27 quantizações.
- Pacotes Windows/Linux são montados no Mac; execução nativa nessas plataformas continua pendente. RAM é estimativa, não benchmark. Acesso público verificado pode mudar na origem, por isso é conferido novamente antes de cada download.
