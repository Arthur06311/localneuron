import {
  uid,
  duration,
  addClip,
  getAsset,
  saveProject,
  newProject,
} from "./studio-project.js";
export function createStudioPro({
  api,
  E,
  toast,
  isVisible,
  project,
  selected,
  change,
  save,
  addBlob,
  addGeneration,
  selectProject,
  refresh,
  lock,
  time,
}) {
  const $ = (s) => document.querySelector(s);
  let active = false,
    cancelled = false,
    interval = null,
    proJob = null;
  const download = (blob, name) => {
    const url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };
  const status = (t) => {
    if ($("#studio-pro-status")) $("#studio-pro-status").textContent = t;
  };
  function modal() {
    document.querySelector("#studio-pro-dialog")?.remove();
    const d = document.createElement("dialog");
    d.id = "studio-pro-dialog";
    d.innerHTML = `<div class="dialog-head"><div><span class="eyebrow">ESTÚDIO PRO</span><h2>Da ideia à edição.</h2></div><button class="icon-button" id="studio-pro-close" aria-label="Fechar ferramentas">×</button></div><nav class="studio-pro-nav">${[
      ["story", "Criar vídeo"],
      ["captions", "Legendas"],
      ["voice", "Narração"],
      ["layers", "Camadas"],
      ["inpaint", "Editar imagem"],
      ["social", "Redes sociais"],
    ]
      .map(
        ([k, l]) =>
          `<button class="secondary" data-pro-media-tab="${k}">${l}</button>`,
      )
      .join(
        "",
      )}</nav><section id="studio-pro-body"></section><p id="studio-pro-status" role="status"></p><button class="secondary" id="studio-pro-cancel" hidden>Cancelar processamento</button>`;
    document.body.append(d);
    d.showModal();
    $("#studio-pro-close").onclick = () => d.close();
    $("#studio-pro-cancel").onclick = stop;
    d.addEventListener("close", () => {
      stop();
      d.remove();
    });
    page("story");
  }
  const assetOptions = (kind) =>
    project()
      .assets.filter((a) =>
        kind === "visual"
          ? a.kind !== "audio"
          : a.kind === "audio" || a.kind === "video",
      )
      .map((a) => `<option value="${a.id}">${E(a.name)}</option>`)
      .join("");
  async function page(name) {
    if (active) return;
    clearInterval(interval);
    document
      .querySelectorAll("[data-pro-media-tab]")
      .forEach((b) =>
        b.classList.toggle("active", b.dataset.proMediaTab === name),
      );
    const body = $("#studio-pro-body");
    if (!body) return;
    if (name === "voice") {
      const s = await api("/pro/media");
      body.innerHTML = `<h3>Narração no seu computador</h3><p>Voz Faber · português brasileiro · 22.050 Hz. <a href="${s.voice.source}" target="_blank" rel="noreferrer">Licença e origem</a></p>${s.voice.installed ? `<label>Texto da narração<textarea id="studio-voice-text" rows="5" maxlength="4000" placeholder="Escreva a narração…"></textarea></label><label>Velocidade<input id="studio-voice-speed" type="range" min="0.5" max="2" step="0.1" value="1"></label><button class="primary" data-pro-media="narrate">Gerar e adicionar ao vídeo</button>` : `<p>Baixe ${(s.voice.bytes / 1024 ** 2).toFixed(1)} MiB uma vez. Depois a voz funciona offline.</p><button class="primary" data-pro-media="install-voice">Instalar voz Faber</button>`}`;
    }
    if (name === "captions")
      body.innerHTML = `<h3>Legendas sincronizadas automaticamente</h3><p>Escolha o áudio ou vídeo que contém a fala. Whisper cria os intervalos; você pode revisar cada legenda na linha do tempo.</p><label>Mídia com fala<select id="studio-caption-source">${assetOptions("audio")}</select></label><label>Modelo Whisper<select id="studio-caption-model"></select></label><label>Idioma<select id="studio-caption-language"><option value="pt">Português</option><option value="en">Inglês</option><option value="es">Espanhol</option><option value="auto">Automático</option></select></label><div class="actions"><button class="primary" data-pro-media="caption">Transcrever e criar legendas</button><button class="secondary" data-pro-media="srt">Baixar legendas SRT</button></div><p>Até 5 minutos de fala por operação. Estilo e texto continuam editáveis.</p>`;
    if (name === "captions") {
      const s = await api("/local-engines");
      if ($("#studio-caption-model"))
        $("#studio-caption-model").innerHTML =
          s.models
            .filter((m) => m.kind === "speech" && m.installed)
            .map(
              (m) =>
                `<option value="${m.id}" ${m.id === "whisper-small" ? "selected" : ""}>${E(m.name)}</option>`,
            )
            .join("") ||
          '<option value="">Instale Whisper nas configurações de voz</option>';
    }
    if (name === "layers")
      body.innerHTML = `<h3>Composição em camadas</h3><p>Adicione até seis sobreposições visuais e seis faixas de áudio extras. Selecione uma faixa para ajustar sua posição e duração.</p><label>Imagem ou vídeo<select id="studio-layer-asset">${assetOptions("visual")}</select></label><button class="primary" data-pro-media="add-layer">Adicionar sobreposição</button><label>Áudio<select id="studio-extra-audio">${project()
        .assets.filter((a) => a.kind === "audio")
        .map((a) => `<option value="${a.id}">${E(a.name)}</option>`)
        .join(
          "",
        )}</select></label><button class="secondary" data-pro-media="add-audio">Adicionar faixa de áudio</button><div id="studio-layer-list">${[...(project().layers || []), ...(project().audios || [])].map((l) => `<p><button class="secondary" data-pro-layer="${l.id}">${E(project().assets.find((a) => a.id === l.asset)?.name)} · ${l.start.toFixed(1)} s</button></p>`).join("")}</div>`;
    if (name === "social")
      body.innerHTML = `<h3>Um projeto, vários formatos.</h3><p>Crie uma cópia vertical, quadrada ou horizontal. O enquadramento busca o contraste visual da imagem; revise o foco nas propriedades da cena.</p><label>Formato<select id="studio-social-ratio"><option value="9:16">Vertical · Reels, Shorts e TikTok</option><option value="1:1">Quadrado · Feed</option><option value="16:9">Horizontal · YouTube</option></select></label><label class="studio-check"><input type="checkbox" id="studio-social-focus" checked> Sugerir foco para imagens</label><button class="primary" data-pro-media="social">Criar versão adaptada</button>`;
    if (name === "inpaint") {
      body.innerHTML = `<h3>Edite apenas a área escolhida.</h3><p>Escolha uma imagem, pinte de vermelho a área a alterar e descreva o resultado. O original permanece na biblioteca.</p><label>Imagem<select id="studio-inpaint-source">${project()
        .assets.filter((a) => a.kind === "image")
        .map((a) => `<option value="${a.id}">${E(a.name)}</option>`)
        .join(
          "",
        )}</select></label><div class="studio-mask-wrap"><canvas id="studio-mask-base" width="512" height="512"></canvas><canvas id="studio-mask" width="512" height="512" aria-label="Pinte a região a alterar"></canvas></div><label>Pincel<input id="studio-mask-brush" type="range" min="8" max="100" value="40"></label><button class="secondary" data-pro-media="clear-mask">Limpar seleção</button><label>O que criar nessa área?<textarea id="studio-inpaint-prompt" rows="3" maxlength="4000"></textarea></label><button class="primary" data-pro-media="inpaint">Gerar alteração local</button>`;
      await loadMask();
    }
    if (name === "story") {
      const saved = localStorage.getItem("localneuron-storyboard");
      body.innerHTML = `<h3>Crie um vídeo a partir de uma ideia.</h3><p>Gere o roteiro, revise as cenas e produza uma montagem com imagens ou clipes locais. A geração leva tempo e exige modelos instalados.</p><label>Sua ideia<textarea id="studio-story-idea" rows="3" maxlength="4000" placeholder="Ex.: um vídeo curto apresentando uma cafeteria…"></textarea></label><button class="secondary" data-pro-media="story-plan">Criar roteiro com minha IA</button><label>Roteiro editável (JSON)<textarea id="studio-story-json" rows="8" maxlength="20000">${E(
        saved ||
          JSON.stringify(
            {
              title: "Minha história",
              scenes: [
                {
                  prompt: "A cinematic sunrise over a calm lake",
                  narration: "Toda grande ideia começa com um novo olhar.",
                  duration: 5,
                },
                {
                  prompt: "A beautiful trail through a green forest, cinematic",
                  narration: "Explore novos caminhos.",
                  duration: 5,
                },
              ],
            },
            null,
            2,
          ),
      )}</textarea></label><label>Visual<select id="studio-story-model"><option value="sd15">Imagens · Stable Diffusion 1.5</option><option value="wan21">Clipes curtos · Wan 2.1 experimental</option></select></label><label class="studio-check"><input type="checkbox" id="studio-story-voice"> Incluir narração Faber (voz instalada)</label><button class="primary" data-pro-media="story-generate">Gerar cenas e montar no projeto</button><p>A montagem será adicionada ao projeto atual; depois revise e exporte.</p>`;
    }
  }
  async function run(fn) {
    if (active) return;
    active = true;
    cancelled = false;
    lock(true);
    $("#studio-pro-cancel").hidden = false;
    document
      .querySelectorAll(
        "#studio-pro-dialog [data-pro-media],#studio-pro-dialog [data-pro-media-tab],#studio-pro-dialog input,#studio-pro-dialog select,#studio-pro-dialog textarea",
      )
      .forEach((b) => (b.disabled = true));
    try {
      await fn();
      if (!cancelled) {
        await save();
        refresh();
      }
    } catch (e) {
      toast(e.message);
      status(e.message);
    } finally {
      active = false;
      lock(false);
      if ($("#studio-pro-cancel")) $("#studio-pro-cancel").hidden = true;
      document
        .querySelectorAll(
          "#studio-pro-dialog [data-pro-media],#studio-pro-dialog [data-pro-media-tab],#studio-pro-dialog input,#studio-pro-dialog select,#studio-pro-dialog textarea",
        )
        .forEach((b) => (b.disabled = false));
    }
  }
  function check() {
    if (cancelled) throw Error("Processamento cancelado.");
    if (!isVisible()) throw Error("Abra o Estúdio para continuar.");
  }
  async function waitJob(id, kind = "visual") {
    const deadline = Date.now() + 30 * 60000;
    while (Date.now() < deadline) {
      check();
      if (kind === "pro") {
        const s = await api("/pro");
        const j = s.jobs.find((j) => j.id === id);
        if (j?.state === "complete") return j;
        if (["failed", "cancelled", "interrupted"].includes(j?.state))
          throw Error(j.error || "Tarefa interrompida.");
      } else {
        const s = await api("/local-engines");
        const j = s.generation;
        if (j?.id === id && j.state === "complete")
          return {
            ...j,
            prompt: j.kind === "video" ? "Cena em vídeo" : "Cena gerada",
          };
        if (j?.id === id && j.state === "failed") throw Error(j.error);
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    throw Error("A geração excedeu o tempo esperado.");
  }
  async function narrate(text, speed = 1, start = time()) {
    status("Gerando narração local…");
    const result = await api("/pro/media/speak", {
      method: "POST",
      body: { text, speed },
    });
    check();
    const r = await fetch(result.file);
    if (!r.ok) throw Error("Não foi possível abrir o áudio gerado.");
    const meta = await addBlob(await r.blob(), "Narração Faber.wav");
    change(() =>
      project().audios.push({
        id: uid(),
        asset: meta.id,
        start,
        trim: 0,
        volume: 1,
      }),
    );
    return meta;
  }
  function wavChunk(audio, start, end) {
    const frames = Math.floor((end - start) * 16000),
      buffer = new ArrayBuffer(44 + frames * 2),
      v = new DataView(buffer);
    for (const [offset, text] of [
      [0, "RIFF"],
      [8, "WAVE"],
      [12, "fmt "],
      [36, "data"],
    ])
      for (let i = 0; i < text.length; i++)
        v.setUint8(offset + i, text.charCodeAt(i));
    v.setUint32(4, 36 + frames * 2, true);
    v.setUint32(16, 16, true);
    v.setUint16(20, 1, true);
    v.setUint16(22, 1, true);
    v.setUint32(24, 16000, true);
    v.setUint32(28, 32000, true);
    v.setUint16(32, 2, true);
    v.setUint16(34, 16, true);
    v.setUint32(40, frames * 2, true);
    const channels = Array.from({ length: audio.numberOfChannels }, (_, i) =>
      audio.getChannelData(i),
    );
    for (let i = 0; i < frames; i++) {
      const pos = (start + i / 16000) * audio.sampleRate,
        index = Math.floor(pos),
        frac = pos - index;
      let sample = 0;
      for (const c of channels)
        sample += (c[index] || 0) * (1 - frac) + (c[index + 1] || 0) * frac;
      sample /= channels.length;
      v.setInt16(
        44 + i * 2,
        Math.round(Math.max(-1, Math.min(1, sample)) * 32767),
        true,
      );
    }
    let data = "";
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.length; i += 8192)
      data += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return btoa(data);
  }
  async function captions() {
    const p = project(),
      a = p.assets.find((a) => a.id === $("#studio-caption-source").value);
    if (!a) throw Error("Importe um vídeo com áudio ou uma narração.");
    if (a.duration > 600)
      throw Error("Corte a mídia para até 10 minutos antes de transcrever.");
    const model = $("#studio-caption-model").value,
      language = $("#studio-caption-language").value;
    if (!model) throw Error("Instale Whisper primeiro.");
    const source = p.clips.find((c) => c.asset === a.id),
      track =
        p.audios.find((c) => c.asset === a.id) ||
        (p.music?.asset === a.id ? p.music : null);
    const trim = source?.trim ?? track?.trim ?? 0,
      offset = source
        ? p.clips
            .slice(0, p.clips.indexOf(source))
            .reduce((n, c) => n + c.duration, 0)
        : (track?.start ?? 0);
    const length = Math.min(
      source?.duration ?? a.duration - trim,
      300,
      duration(p) - offset,
    );
    if (length <= 0)
      throw Error("Adicione cenas ao projeto antes de legendar.");
    const context = new AudioContext();
    let audio;
    try {
      status("Lendo o áudio…");
      const data = await getAsset(a.id);
      audio = await context.decodeAudioData(await data.blob.arrayBuffer());
    } finally {
      await context.close();
    }
    const texts = [];
    for (let from = trim; from < trim + length; from += 80) {
      check();
      status(
        `Transcrevendo ${Math.round(from - trim)} de ${Math.round(length)} segundos…`,
      );
      const result = await api("/local-engines/transcribe", {
        method: "POST",
        body: {
          model,
          language,
          audio: wavChunk(audio, from, Math.min(trim + length, from + 80)),
        },
      });
      for (const segment of result.segments || []) {
        const start = offset + from - trim + segment.start,
          end = Math.min(offset + length, offset + from - trim + segment.end);
        if (end - start >= 0.2)
          texts.push({
            id: uid(),
            text: segment.text.slice(0, 500),
            start,
            duration: end - start,
            position: "bottom",
            size: 4,
            color: "#ffffff",
            box: true,
            caption: true,
          });
      }
    }
    check();
    change(() => {
      p.texts = p.texts.filter((t) => !t.caption).concat(texts);
    });
    status(
      texts.length +
        " legendas criadas. Revise o texto e os intervalos na linha do tempo.",
    );
  }
  function editLayer(id) {
    const p = project(),
      layer = p.layers.find((l) => l.id === id),
      audio = p.audios.find((l) => l.id === id),
      value = layer || audio;
    if (!value) return;
    modal();
    $("#studio-pro-body").innerHTML =
      `<h3>${E(p.assets.find((a) => a.id === value.asset)?.name)}</h3><form id="studio-layer-form">${[
        ["start", "Começa em (s)", 0, 300],
        ["trim", "Início na mídia (s)", 0, 86400],
        ["volume", "Volume", 0, 1],
        ...(layer
          ? [
              ["duration", "Duração (s)", 0.2, 300],
              ["x", "Centro horizontal", 0, 1],
              ["y", "Centro vertical", 0, 1],
              ["width", "Largura relativa", 0.05, 1],
              ["opacity", "Opacidade", 0, 1],
            ]
          : []),
      ]
        .map(
          ([key, label, min, max]) =>
            `<label>${label}<input name="${key}" type="number" value="${value[key]}" min="${min}" max="${max}" step="0.05" required></label>`,
        )
        .join(
          "",
        )}<button class="primary">Aplicar ajustes</button><button class="secondary" type="button" id="studio-remove-layer">Remover faixa</button></form>`;
    $("#studio-layer-form").onsubmit = (e) => {
      e.preventDefault();
      try {
        change(() =>
          Object.assign(
            value,
            Object.fromEntries(
              [...new FormData(e.target)].map(([k, v]) => [k, Number(v)]),
            ),
          ),
        );
        document.querySelector("#studio-pro-dialog").close();
      } catch (e) {
        toast(e.message);
      }
    };
    $("#studio-remove-layer").onclick = () => {
      change(() => {
        p.layers = p.layers.filter((l) => l.id !== id);
        p.audios = p.audios.filter((l) => l.id !== id);
      });
      $("#studio-pro-dialog").close();
    };
  }
  async function focus(a) {
    if (a.kind !== "image") return [0.5, 0.5];
    const r = await getAsset(a.id),
      bitmap = await createImageBitmap(r.blob),
      c = document.createElement("canvas");
    c.width = 64;
    c.height = 64;
    const ctx = c.getContext("2d");
    ctx.drawImage(bitmap, 0, 0, 64, 64);
    bitmap.close();
    const data = ctx.getImageData(0, 0, 64, 64).data;
    let weight = 0,
      x = 0,
      y = 0;
    for (let j = 2; j < 62; j++)
      for (let i = 2; i < 62; i++) {
        const p = (j * 64 + i) * 4,
          contrast =
            Math.abs(data[p] - data[p - 4]) +
            Math.abs(data[p + 1] - data[p - 3]) +
            Math.abs(data[p + 2] - data[p - 2]) +
            1;
        weight += contrast;
        x += i * contrast;
        y += j * contrast;
      }
    return [x / weight / 64, y / weight / 64];
  }
  async function loadMask() {
    const a = project().assets.find(
      (a) => a.id === $("#studio-inpaint-source")?.value,
    );
    if (!a) return;
    const r = await getAsset(a.id),
      image = await createImageBitmap(r.blob),
      base = $("#studio-mask-base");
    const ratio = Math.min(512 / image.width, 512 / image.height),
      w = image.width * ratio,
      h = image.height * ratio,
      x = (512 - w) / 2,
      y = (512 - h) / 2;
    const ctxBase = base.getContext("2d");
    ctxBase.fillStyle = "#000";
    ctxBase.fillRect(0, 0, 512, 512);
    ctxBase.drawImage(image, x, y, w, h);
    base.dataset.rect = JSON.stringify({ x, y, w, h });
    image.close();
    const mask = $("#studio-mask"),
      ctx = mask.getContext("2d");
    ctx.clearRect(0, 0, 512, 512);
    let drawing = false;
    const point = (e) => {
      const r = mask.getBoundingClientRect();
      return [
        ((e.clientX - r.left) * 512) / r.width,
        ((e.clientY - r.top) * 512) / r.height,
      ];
    };
    mask.onpointerdown = (e) => {
      drawing = true;
      mask.setPointerCapture(e.pointerId);
      ctx.beginPath();
      ctx.moveTo(...point(e));
    };
    mask.onpointermove = (e) => {
      if (!drawing) return;
      ctx.lineWidth = Number($("#studio-mask-brush").value);
      ctx.lineCap = "round";
      ctx.strokeStyle = "#fa5555";
      ctx.lineTo(...point(e));
      ctx.stroke();
    };
    mask.onpointerup = () => (drawing = false);
  }
  document.addEventListener("change", (e) => {
    if (e.target.id === "studio-inpaint-source")
      loadMask().catch((e) => toast(e.message));
  });
  document.addEventListener("click", async (e) => {
    const b = e.target.closest("button");
    if (!b || !isVisible()) return;
    if (b.dataset.studioPro === "tools") {
      try { await api("/subscription/studio",{method:"POST",body:{}}); } catch(error) { toast(error.message); return; }
      modal();
      return;
    }
    if (b.dataset.proLayer) {
      editLayer(b.dataset.proLayer);
      return;
    }
    if (b.dataset.proMediaTab) {
      page(b.dataset.proMediaTab).catch((e) => toast(e.message));
      return;
    }
    const action = b.dataset.proMedia;
    if (!action) return;
    if (action === "clear-mask") {
      $("#studio-mask").getContext("2d").clearRect(0, 0, 512, 512);
      return;
    }
    void run(async () => {
      if (!["srt","install-voice"].includes(action)) await api("/subscription/studio",{method:"POST",body:{}});
      if (action === "install-voice") {
        await api("/pro/media/install-voice", { method: "POST", body: {} });
        while (true) {
          check();
          const s = await api("/pro/media");
          status(
            `Instalando voz · ${Math.round(((s.download?.bytes || 0) / s.voice.bytes) * 100)}%`,
          );
          if (s.voice.installed) {
            status("Voz instalada. Abra Narração para usar.");
            break;
          }
          if (["failed", "cancelled"].includes(s.download?.state))
            throw Error(s.download.error || "Download cancelado.");
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
      if (action === "narrate") {
        if (!project().clips.length)
          throw Error("Adicione cenas antes de inserir a narração.");
        await narrate(
          $("#studio-voice-text").value,
          Number($("#studio-voice-speed").value),
        );
        status("Narração adicionada em uma faixa própria.");
      }
      if (action === "caption") await captions();
      if (action === "srt") {
        const stamp = (t) => {
          const ms = Math.round(t * 1000);
          return `${String(Math.floor(ms / 3600000)).padStart(2, "0")}:${String(Math.floor(ms / 60000) % 60).padStart(2, "0")}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")},${String(ms % 1000).padStart(3, "0")}`;
        };
        const rows = project()
          .texts.filter((t) => t.caption)
          .sort((a, b) => a.start - b.start);
        if (!rows.length) throw Error("Crie legendas automáticas primeiro.");
        download(
          new Blob(
            [
              rows
                .map(
                  (t, i) =>
                    `${i + 1}\n${stamp(t.start)} --> ${stamp(t.start + t.duration)}\n${t.text}`,
                )
                .join("\n\n"),
            ],
            { type: "text/plain" },
          ),
          "legendas.srt",
        );
      }
      if (action === "add-layer") {
        const a = project().assets.find(
          (a) => a.id === $("#studio-layer-asset").value,
        );
        if (!a || !project().clips.length)
          throw Error("Importe uma mídia e crie uma cena antes.");
        change(() =>
          project().layers.push({
            id: uid(),
            asset: a.id,
            start: time(),
            duration: Math.max(
              0.2,
              Math.min(
                4,
                duration(project()) - time(),
                a.kind === "image" ? 4 : a.duration,
              ),
            ),
            trim: 0,
            x: 0.75,
            y: 0.25,
            width: 0.35,
            opacity: 1,
            volume: 0,
          }),
        );
        status("Camada adicionada. Clique na faixa para editar.");
      }
      if (action === "add-audio") {
        const a = project().assets.find(
          (a) => a.id === $("#studio-extra-audio").value,
        );
        if (!a) throw Error("Importe um áudio primeiro.");
        change(() =>
          project().audios.push({
            id: uid(),
            asset: a.id,
            start: time(),
            trim: 0,
            volume: 0.7,
          }),
        );
        status("Faixa de áudio adicionada.");
      }
      if (action === "social") {
        const p = structuredClone(project());
        p.id = uid();
        p.name = (p.name + " · " + $("#studio-social-ratio").value).slice(
          0,
          100,
        );
        p.ratio = $("#studio-social-ratio").value;
        p.pending = null;
        for (const c of p.clips) {
          c.fit = "cover";
          if ($("#studio-social-focus").checked) {
            status("Ajustando enquadramento…");
            [c.focalX, c.focalY] = await focus(
              p.assets.find((a) => a.id === c.asset),
            );
          }
        } // Assets are copied to keep project deletion independent.
        const { storeBundle } = await import("./studio-project.js");
        const records = [],
          mapping = new Map();
        for (const a of p.assets) {
          const old = await getAsset(a.id),
            next = uid();
          mapping.set(a.id, next);
          a.id = next;
          records.push({ id: next, blob: old.blob });
        }
        for (const c of [...p.clips, ...p.layers, ...p.audios])
          c.asset = mapping.get(c.asset);
        if (p.music) p.music.asset = mapping.get(p.music.asset);
        await storeBundle(p, records);
        await selectProject(p.id);
        status("Versão adaptada criada.");
      }
      if (action === "inpaint") {
        const prompt = $("#studio-inpaint-prompt").value;
        if (!prompt.trim()) throw Error("Descreva a alteração.");
        const selection = $("#studio-mask"),
          rgba = selection.getContext("2d").getImageData(0, 0, 512, 512);
        if (!rgba.data.some((v, i) => i % 4 === 3 && v))
          throw Error("Pinte uma região antes de gerar.");
        const mask = document.createElement("canvas");
        mask.width = 512;
        mask.height = 512;
        const ctx = mask.getContext("2d");
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, 512, 512);
        for (let i = 0; i < rgba.data.length; i += 4) {
          const selected = rgba.data[i + 3] > 0 ? 255 : 0;
          rgba.data[i] = rgba.data[i + 1] = rgba.data[i + 2] = selected;
          rgba.data[i + 3] = 255;
        }
        ctx.putImageData(rgba, 0, 0);
        const job = await api("/pro/media/inpaint", {
          method: "POST",
          body: {
            prompt,
            image: $("#studio-mask-base").toDataURL("image/png").split(",")[1],
            mask: mask.toDataURL("image/png").split(",")[1],
            steps: 20,
          },
        });
        status("Gerando alteração na região selecionada…");
        const result = await waitJob(job.id);
        check();
        const generated = await fetch(result.file);
        if (!generated.ok) throw Error("Imagem gerada indisponível.");
        const edited = await createImageBitmap(await generated.blob()),
          source = await getAsset($("#studio-inpaint-source").value),
          original = await createImageBitmap(source.blob),
          rect = JSON.parse($("#studio-mask-base").dataset.rect),
          output = document.createElement("canvas"),
          cut = document.createElement("canvas");
        output.width = cut.width = original.width;
        output.height = cut.height = original.height;
        output.getContext("2d").drawImage(original, 0, 0);
        const cutCtx = cut.getContext("2d");
        cutCtx.drawImage(
          edited,
          rect.x,
          rect.y,
          rect.w,
          rect.h,
          0,
          0,
          cut.width,
          cut.height,
        );
        cutCtx.globalCompositeOperation = "destination-in";
        cutCtx.drawImage(
          selection,
          rect.x,
          rect.y,
          rect.w,
          rect.h,
          0,
          0,
          cut.width,
          cut.height,
        );
        output.getContext("2d").drawImage(cut, 0, 0);
        original.close();
        edited.close();
        const blob = await new Promise((r) => output.toBlob(r, "image/png")),
          meta = await addBlob(blob, "Imagem editada.png");
        change(() => addClip(project(), meta));
        status(
          "Imagem editada adicionada. Pixels fora da máscara foram preservados.",
        );
      }
      if (action === "story-plan") {
        const prompt = $("#studio-story-idea").value;
        if (!prompt.trim()) throw Error("Descreva sua ideia.");
        const p = await api("/pro/projects", {
          method: "POST",
          body: { name: "Roteiro · " + project().name.slice(0, 75) },
        });
        const j = await api("/pro/jobs", {
          method: "POST",
          body: { project: p.id, kind: "storyboard", prompt, model: "auto" },
        });
        proJob = j.id;
        status("Criando roteiro com a IA local…");
        const result = await waitJob(j.id, "pro");
        proJob = null;
        const story = JSON.parse(
          result.output.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, ""),
        );
        $("#studio-story-json").value = JSON.stringify(story, null, 2);
        localStorage.setItem(
          "localneuron-storyboard",
          $("#studio-story-json").value,
        );
        status("Roteiro criado. Revise as cenas antes de gerar.");
      }
      if (action === "story-generate") {
        const story = JSON.parse($("#studio-story-json").value),
          model = $("#studio-story-model").value,
          voice = $("#studio-story-voice").checked;
        if (
          !Array.isArray(story.scenes) ||
          story.scenes.length < 1 ||
          story.scenes.length > 6 ||
          story.scenes.some(
            (s) =>
              typeof s.prompt !== "string" ||
              s.prompt.length > 4000 ||
              typeof s.narration !== "string" ||
              s.narration.length > 300 ||
              !Number.isFinite(s.duration) ||
              s.duration < 3 ||
              s.duration > 15,
          )
        )
          throw Error(
            "Roteiro inválido: use 1 a 6 cenas com prompt, narration de até 300 caracteres e duration entre 3 e 15.",
          );
        const available = await api("/local-engines");
        if (!available.models.find((m) => m.id === model && m.installed))
          throw Error("Instale o modelo visual escolhido primeiro.");
        if (voice && !(await api("/pro/media")).voice.installed)
          throw Error("Instale a voz Faber antes de incluir narração.");
        const start = duration(project());
        for (let i = 0; i < story.scenes.length; i++) {
          check();
          const scene = story.scenes[i];
          status(`Gerando cena ${i + 1} de ${story.scenes.length}…`);
          const job = await api("/local-engines/generate", {
            method: "POST",
            body: {
              model,
              prompt: scene.prompt,
              steps: 10,
              aspect: project().ratio,
            },
          });
          const result = await waitJob(job.id);
          await addGeneration(
            { ...result, prompt: scene.prompt },
            project().id,
          );
          change(() => {
            const clip = project().clips.at(-1);
            if (model === "sd15") {
              clip.duration = scene.duration;
              clip.motion = "in";
              clip.fit = "cover";
            }
            const at = duration(project()) - clip.duration;
            if (scene.narration)
              project().texts.push({
                id: uid(),
                text: scene.narration,
                start: at,
                duration: clip.duration,
                position: "bottom",
                size: 4,
                color: "#ffffff",
                box: true,
              });
          });
          await save();
        }
        if (voice) {
          const audio = await narrate(
            story.scenes.map((s) => s.narration).join(" "),
            1,
            start,
          );
          if (start + audio.duration > duration(project()) && model === "sd15")
            change(
              () =>
                (project().clips.at(-1).duration +=
                  start + audio.duration - duration(project())),
            );
        }
        status(
          "Montagem criada. Revise cenas e narração, depois exporte o vídeo.",
        );
      }
    });
  });
  function tracks(el) {
    if (!el || !project()) return;
    for (const [kind, items] of [
      ["CAMADAS", project().layers || []],
      ["ÁUDIO +", project().audios || []],
    ])
      if (items.length) {
        const row = document.createElement("div");
        row.className = "studio-track";
        row.innerHTML = `<span class="studio-track-label">${kind}</span><div class="studio-overlay-track">${items.map((l) => `<button class="studio-layer-chip" data-pro-layer="${l.id}">${E(project().assets.find((a) => a.id === l.asset)?.name)}</button>`).join("")}</div>`;
        el.append(row);
        row.querySelectorAll("button").forEach((b, i) => {
          b.style.position = "absolute";
          b.style.left =
            (items[i].start / Math.max(1, duration(project()))) * 100 + "%";
          b.style.maxWidth = "90%";
        });
      }
  }
  function stop() {
    clearInterval(interval);
    if (active) {
      cancelled = true;
      if (proJob)
        void api("/pro/jobs/" + proJob + "/cancel", {
          method: "POST",
          body: {},
        }).catch(() => {});
      proJob = null;
      void api("/pro/media/stop", { method: "POST", body: {} }).catch(() => {});
    }
  }
  return { tracks, stop };
}
