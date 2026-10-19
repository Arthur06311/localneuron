# Documentação do LocalNeuron

Este índice separa a documentação por assunto. Os caminhos do código continuam estáveis para que uma migração de repositório ou de máquina não quebre imports, scripts ou dados existentes.

## Começar

- [README do projeto](../README.md): visão geral, downloads, limites e desenvolvimento.
- [Configuração completa](configuracao.md): primeiro acesso, motores, modelos, bots, API, EXO, conexões e backup.
- [Plataformas](plataformas.md): macOS, Windows, Linux, runtimes e empacotamento.
- [Instalação Linux](linux-installer.md): instalador, pacotes nativos e diagnóstico do crash no Omarchy.
- [Nome no Spotlight](macos-spotlight.md): como o app aparece na busca do macOS.
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
- [Publicar uma versão](RELEASE.md): tag, DMG, ZIP, DEB, Arch, AppImage, NSIS, rascunho e o que ainda falta de assinatura.
- [Domínio Name.com](dominio-namecom.md): DNS e domínio próprio.
- [Minha API](minha-api.md): endpoint compatível em rede privada.
- [Operação da assinatura](subscription-operations.md): serviço Pro e Stripe.
- [Verificação](verification.md): evidências e limites de validação.
- [Notas da 0.27](localneuron-0.27.md): acesso lembrado, equipe e avisos de atualização.
- [Licença do aplicativo](../LICENSE): código proprietário, de código fechado; todos os direitos reservados.
- [Licenças de terceiros](../THIRD_PARTY.md).

## Dados de catálogo

Registros JSON das auditorias do catálogo, citados em [Modelos](modelos.md) e [Verificação](verification.md). Não são guias:

- [`catalog-sources.json`](catalog-sources.json) e [`catalog-09-sources.json`](catalog-09-sources.json): repositórios, revisões e licenças fixados nas ampliações do catálogo.
- [`catalog-access.json`](catalog-access.json): conferência de acesso público aos arquivos dos modelos de texto.
- [`media-access.json`](media-access.json): conferência dos arquivos dos modelos de mídia.
- [`model-icon-sources.json`](model-icon-sources.json): origem dos ícones dos modelos.

## Histórico

- [Changelog](../CHANGELOG.md): uma linha por versão, só com o que está nas notas, nas tags Git e no `package.json`.
- Notas de versão: [0.8](localneuron-0.8.md), [0.9](localneuron-0.9.md), [0.10](localneuron-0.10.md), [0.11](localneuron-0.11.md), [0.12](localneuron-0.12.md), [0.13](localneuron-0.13.md), [0.14](localneuron-0.14.md), [0.15](localneuron-0.15.md), [0.16](localneuron-0.16.md), [0.17](localneuron-0.17.md), [0.18](localneuron-0.18.md), [0.19](localneuron-0.19.md), [0.20](localneuron-0.20.md), [0.21](localneuron-0.21.md) e [0.27](localneuron-0.27.md). Não há notas separadas da 0.22 à 0.26.
- [Revisão de lançamento 0.23](release-readiness.md).
- Revisões de UX/UI: [0.27](ux-review-0.27.md) e [navegação por ilhas](ux-review-navegacao-ilhas.md).

Os arquivos `localneuron-*.md` registram decisões e estados de versões antigas. Eles são histórico técnico, não instruções para substituir os guias atuais.
