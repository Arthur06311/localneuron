# LocalNeuron 0.16 · Imagem, vídeo e identificação visual

Adicionadas **360 entradas visuais: 260 de imagem e 100 de vídeo**. A biblioteca tem agora **1.027 entradas**, somando 661 de texto e 366 visuais. O total inclui versões, conversões, ajustes e componentes; não representa 1.027 famílias distintas.

## Usar a biblioteca

Abra **Modelos**, escolha **Imagem** ou **Vídeo** e procure por nome, família ou publicador. Cada ficha informa a finalidade e diferencia modelos completos de complementos. Exemplos das famílias catalogadas incluem Stable Diffusion, FLUX, Qwen Image, Z-Image, Hunyuan, Wan e LTX.

Todas as entradas têm identificação visual: **915 usam avatares públicos dos publicadores e 112 usam iniciais e cores**. As imagens ficam dentro do aplicativo e funcionam offline. As correspondências e origens estão em [model-icon-sources.json](model-icon-sources.json).

Use **Pronto para gerar** para ver os perfis integrados ao Estúdio. Foram acrescentados seis perfis completos SD 1.x: DreamShaper, CyberRealistic, Photon, majicMIX e duas distribuições do SD 1.5. Eles se somam aos perfis SD 1.5 e Wan já existentes. Conversões que compartilham pesos não representam capacidades novas.

Na ficha, **Instalar no Estúdio** baixa e verifica os arquivos do perfil. Depois, **Abrir no Estúdio** seleciona esse perfil para geração. A estimativa desses perfis SD 1.x é de 6 GiB; o aplicativo também exige margem de memória livre. O valor é uma estimativa, não um benchmark.

Nas outras fichas, abra a lista de arquivos, escolha o peso e use **Baixar arquivo**. Há tamanho exato, progresso, pausa, retomada e conferência SHA-256. Os arquivos são guardados em `media-models/<identificador>/<caminho original>`, dentro da área local de dados. Baixar pesos por esse fluxo não instala automaticamente um pipeline no Estúdio. Modelos não integrados ainda precisam de um motor compatível, configurações e, em alguns casos, componentes adicionais. Um adaptador, VAE ou codificador isolado não gera imagens ou vídeos sozinho.

## Acesso e verificação

O catálogo visual lista **4.445 arquivos de pesos** com revisão fixada, tamanho e SHA-256. Todas as 360 novas entradas tiveram seus arquivos listados conferidos por metadados e HEAD sem autenticação. Ao todo, 365 entradas visuais foram públicas na auditoria; a referência anterior FLUX.1-schnell exige autorização e está marcada como restrita. [Auditoria visual](media-access.json).

O acesso é revalidado antes de baixar. Um token autorizado do Hugging Face, quando necessário, usa o cofre existente e não é encaminhado a redirecionamentos CDN. Pausar ou bloquear o cofre preserva partes transferidas. Mudanças de revisão ou hash impedem a reutilização de um trabalho antigo incompatível. Downloads de texto, pesos visuais e instalações nativas compartilham exclusão para evitar transferências concorrentes acidentais.

As licenças continuam sendo as de cada publicador. Acesso público não significa permissão irrestrita de uso. O catálogo prioriza pesos públicos; não promete que cada entrada seja software open source segundo uma definição formal.

## Evidência e limites

- 102 testes automatizados passaram, incluindo cobertura de identidade das 1.027 entradas, renderização das 366 fichas visuais, unicidade, hashes, retomada, falhas de credencial e bloqueio pelo cofre.
- Um arquivo real de componente do LTX-2.5, com 3.843.690 bytes, foi baixado pelo novo fluxo e validado por SHA-256. Isso verifica transferência, não geração de vídeo.
- Um novo perfil SD 1.5 foi conferido com pesos completos de hash correspondente em uma área isolada. O catálogo abriu o perfil correto no Estúdio. A tentativa de geração foi impedida pela proteção de memória disponível deste Mac; não se afirma geração validada para os seis perfis novos.
- Interface conferida em claro e escuro, nos filtros de imagem e vídeo, no Estúdio e em largura de 390 px, sem transbordamento horizontal ou erros de console observados.
- Os milhares de pesos não foram baixados nem executados em conjunto. As verificações de acesso não garantem qualidade, desempenho ou compatibilidade de todos os pipelines.
- Pacotes Windows e Linux são montados no Mac; execução nativa nessas plataformas permanece pendente. Os motores mantêm as revisões anteriores.

Os três pacotes 0.16 foram comparados com a fonte e os arquivos compactados foram verificados. A assinatura ad hoc do Mac extraído passou na conferência estrita. Os 1.004 arquivos do manifesto de dados permaneceram iguais antes da reabertura; o aplicativo voltou à tela de desbloqueio.
