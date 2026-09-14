# LocalNeuron 0.13 — Chat e ferramentas

As melhorias desta versão estão no **Chat**, sem mudar a senha, apagar conversas ou configurar cobrança.

## Novos recursos

1. **Anexar documentos diretamente ao chat.** Use Anexar, escolha arquivos e faça sua pergunta. PDF, Word, Excel, CSV, texto e código são extraídos localmente. Depois da resposta, abra “Trechos consultados nos anexos” para conferir arquivo, localização e conteúdo enviado à IA. Os anexos continuam disponíveis nas perguntas seguintes dessa conversa.
2. **Memória por conversa.** Use Memória para registrar nomes, fatos e preferências revisados por você. Até 6.000 caracteres acompanham as próximas respostas e as ramificações. O modelo não altera essa memória sozinho e isso não modifica seus pesos.
3. **Comandos reutilizáveis.** Há 12 sugestões para resumir, revisar, programar, pesquisar, comparar, extrair tabelas e planejar. Edite e salve até 100 comandos pessoais. “Usar no rascunho” insere o texto para sua revisão antes de enviar.
4. **Ramificar e editar sem perder o original.** “Editar em nova conversa” recupera sua pergunta e anexos como rascunho, com o histórico anterior. “Ramificar daqui” copia a conversa até a resposta escolhida. Nenhuma ferramenta é executada automaticamente ao criar a cópia.
5. **Perfis rápidos de ferramentas.** Escolha Só conversar, Arquivos · só leitura ou Pesquisa na internet. O modo de leitura bloqueia escrita e terminal no backend, mesmo se as permissões individuais estiverem ativas. Para consultar arquivos do disco, selecione uma pasta em Ferramentas. Ajustes personalizados continuam disponíveis, com revisão das ações existentes.
6. **Busca dentro da conversa.** Use Buscar para localizar mensagens por texto ou pelo nome de um anexo. Clique no resultado para ir ao ponto correspondente. A busca não apaga nem filtra o histórico enviado ao modelo.
7. **Abrir uma resposta no Pro.** Ao lado de uma resposta concluída, use Abrir no Pro. Um novo projeto recebe o texto e a memória da conversa, prontos para editar, versionar e exportar. O Chat original continua intacto.

A exportação Markdown da conversa agora inclui memória, nomes dos anexos e identificação dos trechos consultados. As notificações foram reposicionadas para não bloquear os botões do compositor.

## Arquivos e contexto

Cada mensagem aceita até quatro arquivos de 12 MiB. A leitura retém até 50 trechos ou 100 mil caracteres de cada arquivo; arquivos maiores em texto recebem a indicação “parcial”. PDF escaneado exige OCR externo; imagens e vídeos não são interpretados por este fluxo de anexos. O arquivo original não é alterado; somente o texto extraído acompanha a conversa salva.

A recuperação é lexical: até seis trechos são selecionados para a pergunta, dentro do espaço de contexto disponível. Perguntas gerais podem usar os primeiros trechos dos anexos recentes. A seção de fontes mostra exatamente os trechos preparados para consulta; confira a resposta, pois o modelo pode errar ou omitir uma citação. Modelos pequenos continuam limitados em raciocínio e qualidade.

A memória e os trechos ficam no armazenamento local da conversa, sem cifragem do conteúdo. A senha do aplicativo protege o acesso pelo painel e o cofre de chaves. Os comandos pessoais ficam no armazenamento do navegador usado pelo aplicativo. O backup Pro da versão 0.12 mantém seu escopo de projetos Pro e Estúdio; use também a exportação do Chat para seus registros.

Anexos são dados, não instruções. Consultas externas feitas pelo agente depois de usar anexos, memória ou arquivos locais passam pela revisão existente da consulta. O perfil de pesquisa habilita acesso web; os perfis de conversa e leitura local deixam a pesquisa desligada. Ferramentas e anexos não tornam a inferência em nuvem: os modelos integrados continuam locais.

## Compatibilidade

GGUF funciona pelos motores integrados das três plataformas; MLX continua específico do Mac Apple Silicon. Esta versão foi exercitada no Mac com Qwen3-0.6B, incluindo anexo, memória, ramificação e abertura no Pro. O objetivo dos testes é verificar os fluxos; não é um benchmark de qualidade de todos os modelos. Pacotes Windows e Linux são inspecionados, mas sua execução nativa ainda exige validação.
