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

Os instaladores são grandes: eles entram como arquivos da GitHub Release, nunca dentro de um commit. O passo a passo, a checagem da tag e o que ainda falta de assinatura estão em [Publicar uma versão](RELEASE.md).

O workflow Release gera o AppImage Linux, o instalador NSIS Windows, `SHA256SUMS.txt` e um `releases.json` candidato, e deixa a release em **rascunho**. O macOS continua manual, sem notarização.

A página e o aplicativo leem catálogos gerados do mesmo arquivo, `website/release-source.json`:

```bash
node scripts/build-release-manifest.mjs
```

Isso reescreve `website/downloads.json` e `website/releases.json`. Não edite os dois à mão. Só mude `available` para `true` quando o link da release publicada existir. A configuração pública de assinatura continua sem chave privada.

Os modelos em `.github/workflow-templates/` não são o fluxo de release. O CI de testes é `.github/workflows/ci.yml`. Gerar um pacote não substitui teste nativo de inferência, áudio, GPU ou periféricos. A distribuição Apple continua ad hoc até haver Developer ID e notarização reais.

Referências: [GitHub Pages com Actions](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), [arquivos de releases](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases).

## Domínio na Name.com

Veja o [passo a passo com os registros DNS](dominio-namecom.md). O endereço completo do domínio precisa ser confirmado antes de configurar o CNAME.
