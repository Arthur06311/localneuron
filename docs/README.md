# Documentação do LocalNeuron

Este índice separa a documentação por assunto. Os caminhos do código continuam estáveis para que uma migração de repositório ou de máquina não quebre imports, scripts ou dados existentes.

## Começar

- [README do projeto](../README.md): visão geral, downloads, limites e desenvolvimento.
- [Configuração completa](configuracao.md): primeiro acesso, motores, modelos, bots, API, EXO, conexões e backup.
- [Plataformas](plataformas.md): macOS, Windows, Linux, runtimes e empacotamento.
- [Operação e recuperação](operations.md): senha, dados, backup, tarefas interrompidas e revogação.

## Arquitetura e migração

- [Mapa do projeto e relatório de migração](project-organization-and-migration.md): diretórios, fluxo de inicialização, responsabilidades do código, dados, segredos, comandos e checklist de mudança.
- [Arquitetura técnica](architecture.md): serviço local, PGlite, autorização, inferência e limites de segurança.
- [API administrativa](api.md): rotas locais e comportamento de sessão.
- [Protocolo](protocol.md): contratos de estado, eventos e validação.

## Modelos e motores

- [Modelos](modelos.md): catálogo, acesso, memória, licenças e downloads.
- [MLX independente](mlx-independente.md): runtime Apple Silicon e execução offline.
- [Motor e assistente](motor-e-assistente.md): inferência, ferramentas, aprovações e controle do computador.
- [Rede EXO](exo.md): conexão de máquinas e execução distribuída.
- [Creative Studio](creative-studio.md): Photo, Video, Música, Editor e voz.

## Produto, publicação e suporte

- [Publicação no GitHub](github-publicacao.md): GitHub Pages, releases, hashes e domínio.
- [Domínio Name.com](dominio-namecom.md): DNS e domínio próprio.
- [Minha API](minha-api.md): endpoint compatível em rede privada.
- [Operação da assinatura](subscription-operations.md): serviço Pro e Stripe.
- [Verificação](verification.md): evidências e limites de validação.
- [Licenças de terceiros](../THIRD_PARTY.md).

Os arquivos `localneuron-*.md` registram decisões e estados de versões antigas. Eles são histórico técnico, não instruções para substituir os guias atuais.
