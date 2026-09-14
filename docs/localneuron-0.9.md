# LocalNeuron 0.9 — voz e biblioteca

O microfone redondo fica ao lado de Enviar. Toque uma vez para gravar e novamente para terminar. As barras respondem ao nível de áudio e o cronômetro mostra o limite de 85 segundos. **Descartar** ou **Esc** cancela a gravação. O texto reconhecido entra no rascunho; você revisa e envia.

A transcrição passa a usar **Whisper Small** e **português** por padrão, com busca de cinco candidatos no decodificador. Isso favorece precisão em relação ao perfil anterior Tiny com um candidato, com maior uso de memória. O modelo é baixado uma vez: 487.601.967 bytes, aproximadamente 488 MB. Nos ajustes do chat, em Configurar transcrição local, é possível escolher Tiny, Base, Small ou Large v3 Turbo e mudar para detecção automática, inglês ou espanhol. O desempenho depende do áudio, idioma, modelo e hardware; não há garantia de acerto em toda fala.

Gravações praticamente silenciosas são recusadas antes da inferência. Áudio muito baixo ou saturado gera orientação. Se a requisição de transcrição falhar, **Tentar novamente** reutiliza a gravação mantida temporariamente em memória; **Descartar**, navegar para outra página ou fechar o aplicativo a elimina. O áudio temporário no servidor continua sendo apagado ao concluir. Microfone físico exige permissão do sistema.

## Encontrar um modelo

O catálogo agora tem **579 modelos de texto: 350 novos**. Cada entrada identifica o modelo/fine-tune e uma variante GGUF, com uso sugerido, descrição, tamanho exato, RAM estimada, licença, publicador, revisão e SHA-256. A seleção usa metadados publicados, popularidade e disponibilidade de um conjunto de arquivos completo; não representa avaliação de qualidade de todos os modelos. Variantes QAT têm treinamento diferente e estão identificadas pelo nome.

- **Favoritar** guarda uma seleção neste navegador/aplicativo. O filtro Favoritos a reúne em uma página.
- **Comparar** seleciona até três modelos. Compare uso, download, RAM, formato e licença antes de baixar.
- **Baixados** mostra modelos do catálogo já presentes localmente.
- **Cabe agora** usa a estimativa de RAM mais margem de 1 GiB. A admissão real é conferida novamente pelo motor; outros aplicativos e contexto maior podem mudar a disponibilidade.
- Os filtros de tarefa, família e computador, busca, paginação e explorador do Hugging Face continuam disponíveis.

As novas entradas incluem licenças permissivas e comunitárias, como Gemma e Llama. Consulte os termos do modelo original e da conversão. O suporte depende da arquitetura e do hardware; os pesos de todos os modelos não são incluídos no aplicativo nem baixados automaticamente. Modelos com componentes visuais adicionais continuam limitados a texto neste chat.

A versão mantém dados, senha, ícone, temas, Internet e Esforço. Os motores e as limitações de plataforma são os mesmos da versão 0.8. Windows/Linux são empacotados, mas ainda precisam de execução nativa nesses sistemas. Vídeo permanece experimental.
