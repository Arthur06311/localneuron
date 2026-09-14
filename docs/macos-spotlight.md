# Nome do aplicativo no Spotlight

O aplicativo atual declara `LocalNeuron` nos campos `CFBundleName` e `CFBundleDisplayName`. O identificador interno `dev.colmeia.local` permanece estável para preservar a identidade do aplicativo no sistema.

Em 13/09/2026, a busca ainda encontrava uma cópia 0.7 chamada `Colmeia.app`. Essa cópia foi desregistrada e guardada em `work/legacy-apps.noindex/Colmeia-0.7.app`, fora dos aplicativos de uso diário. O registro da versão atual foi atualizado com Launch Services e foi solicitada sua importação pelo Spotlight.

Foi criado um alias do Finder em `~/Applications/LocalNeuron.app`, apontando para a versão atual no projeto. A resolução do alias e a abertura foram conferidas. O atalho não contém outra cópia do aplicativo, dados ou licença.

O empacotador macOS passa a atualizar a data do bundle, registrar a versão instalada e solicitar a indexação depois de cada substituição. A indexação do Spotlight é assíncrona: a importação pode terminar antes de o resultado aparecer na busca. A consulta ao índice confirmou a retirada da aplicação antiga; o novo resultado ainda aguardava indexação ao finalizar a correção.
