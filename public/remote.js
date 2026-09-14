let key = "",
  controller = null;
const history = [],
  $ = (s) => document.querySelector(s);
function message(role, text) {
  const article = document.createElement("article");
  article.className = role;
  article.textContent = text;
  $("#messages").append(article);
  article.scrollIntoView({ block: "end" });
  return article;
}
$("#login").onclick = async () => {
  try {
    const value = $("#key").value.trim(),
      r = await fetch("/v1/models", {
        headers: { Authorization: "Bearer " + value },
      });
    if (!r.ok) throw Error("Chave inválida ou API indisponível.");
    key = value;
    $("#key").value = "";
    $("#connect").hidden = true;
    $("#conversation").hidden = false;
    $("#prompt").focus();
  } catch (e) {
    $("#connection-error").textContent = e.message;
  }
};
$("#disconnect").onclick = () => {
  controller?.abort();
  key = "";
  history.length = 0;
  $("#messages").replaceChildren();
  $("#connect").hidden = false;
  $("#conversation").hidden = true;
};
$("#stop").onclick = () => controller?.abort();
$("#composer").onsubmit = async (e) => {
  e.preventDefault();
  if (controller) return;
  const content = $("#prompt").value.trim();
  if (!content) return;
  const turns = [...history.slice(-30), { role: "user", content }];
  message("user", content);
  const answer = message("assistant", "Respondendo no seu computador…");
  $("#prompt").value = "";
  controller = new AbortController();
  $("#send").disabled = true;
  $("#stop").hidden = false;
  try {
    const r = await fetch("/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: "Bearer " + key,
      },
      body: JSON.stringify({
        model: "local",
        messages: turns,
        max_tokens: 2048,
      }),
      signal: controller.signal,
    });
    const data = await r.json();
    if (!r.ok)
      throw Error(data.error?.message || "Não foi possível responder.");
    const text = data.choices[0].message.content;
    answer.textContent = text;
    history.push(
      { role: "user", content },
      { role: "assistant", content: text },
    );
  } catch (e) {
    answer.textContent =
      e.name === "AbortError" ? "Resposta interrompida." : e.message;
  } finally {
    controller = null;
    $("#send").disabled = false;
    $("#stop").hidden = true;
  }
};
