# Demo do LocalNeuron: roteiro e storyboard

O documento, as legendas sobrepostas e o texto alternativo estão em **pt-BR**, a língua do site e do README.

## Objetivo e versões

| Versão | Duração | Onde | Formato |
|---|---|---|---|
| **A: GIF do README** | cerca de 20 s (planos 1, 3, 5, 6 e 7; o 6 sai se passar do tamanho) | `README.md`, logo abaixo do título | GIF, 960 px de largura, 12 fps, sem áudio |
| **B: vídeo do site** | cerca de 40 s (todos os planos) | `website/index.html`, no lugar ou ao lado de `product.png` | MP4 H.264 e WebM VP9, 1280 × 800, 30 fps, sem áudio, com poster |

A mensagem a passar é esta: escolher um modelo, conversar offline, criar uma imagem e servir a mesma IA a outro app, tudo no próprio computador.

Todos os planos usam funções que existem no repositório (0.27): ilhas de navegação Trabalhar/Criar/Conectar, biblioteca **Modelos** com RAM estimada, botão **Usar offline · desativar Internet e Terminal** no Chat, **Imagem (Photo)** com stable-diffusion.cpp e **Minha API** com **Gerar chave** e **Preparar IA e ligar API →**.

**Fica de fora de propósito:** EXO com duas máquinas (ainda não homologado), Editor/DaVinci (ponte validada só com SDK simulado) e Pro (cobrança não ativa). Não se deve mostrar o que ainda não foi validado.

## Storyboard (versão B, cerca de 40 s)

| # | Tempo | O que está na tela | Ação | Legenda / overlay (pt-BR) |
|---|---|---|---|---|
| 1 | 0:00–0:03 | App aberta em modo escuro, ilha **Trabalhar** expandida, Chat vazio | Cursor parado; zoom suave de 105 % para 100 % | **LocalNeuron** · Sua IA. Seu computador. |
| 2 | 0:03–0:09 | **Trabalhar → Modelos**, pesquisa “Qwen”, ficha de um modelo de texto pequeno Q4 marcado como integrado | Escrever “Qwen”, abrir a ficha e destacar RAM estimada, tamanho, licença e motor. Clicar **Baixar**; corte direto para o download concluído | Compare RAM, tamanho e licença antes de baixar · *download acelerado* |
| 3 | 0:09–0:19 | **Chat** com o modelo selecionado | Clicar **Ferramentas → Usar offline · desativar Internet e Terminal**. Escrever: “Resuma em 3 tópicos por que rodar IA no próprio computador ajuda na privacidade.” A resposta aparece em streaming | Offline: a resposta é gerada no seu computador |
| 4 | 0:19–0:25 | **Criar → Imagem (Photo)** com um perfil integrado já instalado | Escrever “Um farol ao entardecer, estilo aquarela”, clicar para gerar e cortar para o resultado | Imagem local com stable-diffusion.cpp · *tempo de geração cortado* |
| 5 | 0:25–0:32 | **Conectar → Minha API** | Escolher a IA, opção “somente este computador”, **Gerar chave** (chave desfocada), **Preparar IA e ligar API →**. Aparece a URL base (porta 4320) e o modelo `local` | Minha API: compatível com OpenAI Chat Completions |
| 6 | 0:32–0:37 | Terminal ao lado do app | Colar o comando `curl` (abaixo) e mostrar a resposta JSON | Outro app, a mesma IA local |
| 7 | 0:37–0:40 | Cartão final escuro (`#080b0e`) com o ícone e o acento lima `#c8fc60` | Estático | Sua IA. Seu computador. · localneuron.ai · Alfa 0.27 |

A **versão A (GIF)** junta os planos 1 (2 s), 3 (8 s), 5 (5 s), 6 (3 s) e 7 (2 s), cerca de 20 s. Se o GIF ficar acima do orçamento, corta-se o 6.

Comando do plano 6 (a chave vem de uma variável de ambiente e nunca aparece na tela):

```sh
curl -s http://127.0.0.1:4320/v1/chat/completions \
  -H "Authorization: Bearer $LOCALNEURON_KEY" -H "Content-Type: application/json" \
  -d '{"model":"local","messages":[{"role":"user","content":"Diga olá em uma frase."}]}'
```

O formato `Authorization: Bearer <chave>` está confirmado em `src/gateway.ts`. Use a URL base exatamente como aparece no painel (no modo “somente este computador” deve ser o loopback). Pedidos com cabeçalho `Origin` de navegador são recusados (403), mas o `curl` não envia esse cabeçalho.

## Preparação antes de gravar

- **Máquina:** Mac Apple Silicon, onde a validação real é mais completa. O binário visual exige macOS 26+.
- **Espaço de demonstração limpo.** Use `COLMEIA_DESKTOP_DATA_DIR` apontando para uma pasta nova. Sem conversas pessoais, sem caminhos com o seu nome, sem a licença Pro de teste (o selo deve mostrar **GRÁTIS**) e sem tokens MCP.
- Deixe já baixados o modelo de texto pequeno e o perfil de imagem. O plano 2 mostra só o clique e o corte.
- Ative o modo escuro para combinar com o site. Desligue as notificações, esconda a dock e a área de trabalho, e use escala de interface a 100 %.
- Faça cada plano várias vezes e grave-os separadamente. É mais fácil cortar e acelerar assim.
- **Honestidade.** Qualquer trecho acelerado ou cortado leva o selo “acelerado” ou “cortado”. Nada de tempos por cima do vídeo nem de afirmações de velocidade. Se quiser provar que funciona offline, mostre o Wi-Fi desligado na barra de menus durante o plano 3. É opcional, mas convincente.

## Configurações de gravação

| Item | Recomendação |
|---|---|
| Ferramenta (Mac) | **Kap** (exporta GIF, MP4 e WebM) ou `screencapture -v`/QuickTime e depois ffmpeg. No Windows, **ScreenToGif**; no Linux, OBS ou `wf-recorder`. |
| Área | Só a janela do app, 1440 × 900 pontos (2880 × 1800 em Retina). Proporção 16:10, a mesma de `product.png`. |
| Captura | 30 fps, sem áudio, cursor visível com realce de clique |
| GIF do README | 960 px de largura, 12 fps, 128 cores, **menos de 8 MB** (ideal: menos de 5 MB) |
| Vídeo do site | 1280 × 800, 30 fps, MP4 com menos de 4 MB, WebM com menos de 3 MB, poster PNG/WebP com menos de 200 KB |

### Comandos ffmpeg

```sh
# 1) Juntar e acelerar trechos (exemplo: download 4× mais rápido)
ffmpeg -i plano2.mov -vf "setpts=0.25*PTS" -an plano2-rapido.mov

# 2) GIF do README com paleta otimizada
ffmpeg -i demo-readme.mov -vf "fps=12,scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle" -loop 0 localneuron-demo.gif
#    (opcional) reduzir mais:  gifsicle -O3 --lossy=60 localneuron-demo.gif -o localneuron-demo.gif

# 3) Vídeo do site
ffmpeg -i demo-site.mov -vf "fps=30,scale=1280:-2" -c:v libx264 -preset slow -crf 26 -pix_fmt yuv420p -movflags +faststart -an localneuron-demo.mp4
ffmpeg -i demo-site.mov -vf "fps=30,scale=1280:-2" -c:v libvpx-vp9 -b:v 0 -crf 36 -row-mt 1 -an localneuron-demo.webm

# 4) Poster (frame do plano 3)
ffmpeg -ss 00:00:14 -i demo-site.mov -frames:v 1 -vf "scale=1280:-2" localneuron-demo-poster.png
```

### Integração no site (proposta)

```html
<video class="product-image" autoplay muted loop playsinline preload="metadata" poster="./localneuron-demo-poster.png" width="1280" height="800" aria-label="Demonstração do LocalNeuron: escolher um modelo, conversar offline, gerar uma imagem e ligar a Minha API">
  <source src="./localneuron-demo.webm" type="video/webm">
  <source src="./localneuron-demo.mp4" type="video/mp4">
</video>
```

- Respeite `prefers-reduced-motion`: com essa preferência, mostre só o poster (CSS ou `app.js` faz `video.pause()`).
- **Importante:** `tests/website.test.mjs` tem uma lista fechada dos arquivos de `website/`. Os arquivos novos (`localneuron-demo.mp4`, `.webm` e o poster) precisam entrar nessa lista, senão o teste falha. `.github/workflow-templates/pages.yml` é só um modelo; não há workflow de Pages ativo em `.github/workflows/`. `app.js` também define o `alt` de `.product-image` em 7 línguas; se a imagem for trocada por `<video>`, esse código precisa ser ajustado.
- No README, o GIF pode ficar em `website/localneuron-demo.gif` (o que também obriga a atualizar a lista do teste) ou numa pasta nova `docs/media/`, fora do site, que não mexe no teste.

## Texto alternativo

**pt-BR (curto, para `alt`):**
> Demonstração do LocalNeuron: escolher um modelo na biblioteca, conversar offline, gerar uma imagem localmente e ligar a Minha API.

**pt-BR (descrição longa, para README ou `aria-describedby`):**
> Gravação de cerca de 40 segundos do LocalNeuron 0.27 em um Mac Apple Silicon. Na biblioteca de Modelos, a ficha de um modelo pequeno mostra RAM estimada, tamanho e licença. No Chat, a opção Usar offline desativa Internet e Terminal, e a resposta aparece aos poucos. Em Imagem, um prompt gera uma ilustração de farol em aquarela. Em Minha API, uma chave é criada e a API é ligada; um comando curl no terminal recebe a resposta do mesmo modelo local. Trechos de download e geração foram acelerados ou cortados.

**en (para a versão inglesa do site):**
> LocalNeuron demo: pick a model in the library, chat offline, generate an image locally and turn on My API.
