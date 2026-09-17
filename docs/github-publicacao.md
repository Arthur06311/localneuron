# Publicação no GitHub

O repositório reúne o código do aplicativo e o site informativo em `website/`. O GitHub Pages publica somente essa pasta. O serviço local, cofre e configurações dos usuários não são hospedados pelo Pages.

## Atualizar o site

1. Edite `website/index.html`, `website/style.css`, `website/app.js` ou os textos do guia em `docs/configuracao.md`.
2. Execute `npm ci`, `node scripts/build-website.mjs` e `node --test tests/website.test.mjs`.
3. Faça commit das alterações, inclusive `website/guide.html`, e envie para `main`.
4. Execute `node scripts/publish-pages.mjs` para enviar apenas `website/` à branch `gh-pages`. Em Settings → Pages, a fonte é **Deploy from a branch → gh-pages → / (root)**.
5. Confira a execução automática do GitHub Pages em Actions e abra a URL resultante. Somente uma execução bem-sucedida comprova publicação.

Todos os caminhos de assets são relativos, compatíveis com `https://USUARIO.github.io/localneuron/` e domínio próprio futuro. Quando o titular informar o domínio, configure DNS e Custom domain no GitHub antes de adicionar `website/CNAME`. Não preencha CNAME com um domínio fictício.

O site preserva a escolha manual de idioma e a sugestão automática por país usando `country.is` no navegador, com fallback de idioma. Não há backend Worker, R2, cadastro, compra ou acesso ao app local pelo site.

## Publicar uma versão

Os instaladores são grandes: publique-os como **Release assets**, nunca dentro de um commit. A versão inicial é `v0.26.0`, marcada como pré-lançamento.

1. Execute os testes, gere os pacotes com os manifests fixados e confira os arquivos conforme `docs/plataformas.md`.
2. Use configuração pública de assinatura: `subscription-config.json` sem chaves privadas, licença ou ativação do proprietário. Não inclua dados de usuário.
3. Calcule SHA-256 para cada pacote. Atualize `SHA256SUMS.txt` e `website/releases.json` com nome, bytes, hash e link da versão.
4. Crie um rascunho de Release e anexe os quatro pacotes e `SHA256SUMS.txt`.
5. Confira tamanho e digest retornados pelo GitHub; publique o pré-lançamento.
6. Só depois de confirmar cada link, altere `available` para `true` no manifesto. A página não deve oferecer um instalador ainda não publicado.
7. Confira o site público em desktop e celular e teste o início do download de cada arquivo.

Os modelos de workflows em `.github/workflow-templates/` podem ser habilitados pelo mantenedor em `.github/workflows/`. O workflow **Desktop validation** pode ser executado manualmente para validar/empacotar nos runners de cada sistema. Gerar um pacote não substitui teste nativo de inferência, áudio, GPU ou periféricos. A distribuição Apple continua ad hoc até haver Developer ID e notarização reais.

Referências: [GitHub Pages com Actions](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), [arquivos de releases](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases).

## Domínio na Name.com

Veja o [passo a passo com os registros DNS](dominio-namecom.md). O endereço completo do domínio precisa ser confirmado antes de configurar o CNAME.
