import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { lookup } from "node:dns/promises";
import ipaddr from "ipaddr.js";
import { load } from "cheerio";
export function publicAddress(address: string) {
  try {
    return ipaddr.process(address).range() === "unicast";
  } catch {
    return false;
  }
}
export async function publicPage(
  value: string,
  signal: AbortSignal,
  resolver = lookup,
): Promise<{ url: string; html: string; type: string }> {
  let url = new URL(value);
  for (let redirects = 0; redirects <= 4; redirects++) {
    signal.throwIfAborted();
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      (url.port && !["80", "443"].includes(url.port)) ||
      url.href.length > 3000
    )
      throw new Error("Use uma URL pública HTTP ou HTTPS, sem credenciais.");
    const host = url.hostname.replace(/^\[|\]$/g, "");
    const answers = await resolver(host, { all: true, verbatim: true });
    if (!answers.length || answers.some((a) => !publicAddress(a.address)))
      throw new Error(
        "Endereços internos e privados não estão disponíveis à ferramenta web.",
      );
    const chosen = answers[0];
    const result = await new Promise<{
      status: number;
      headers: import("node:http").IncomingHttpHeaders;
      body: string;
    }>((resolve, reject) => {
      const req = (url.protocol === "https:" ? httpsRequest : httpRequest)(
        url,
        {
          method: "GET",
          signal,
          timeout: 20000,
          ...{ autoSelectFamily: false },
          lookup: ((_hostname: any, _options: any, cb: any) =>
            cb(null, chosen.address, chosen.family)) as any,
          headers: {
            "User-Agent": "Colmeia/0.5 (+local AI; read-only)",
            Accept: "text/html,text/plain,application/json",
            "Accept-Encoding": "identity",
          },
        },
        (res) => {
          if (
            res.statusCode &&
            [301, 302, 303, 307, 308].includes(res.statusCode)
          ) {
            res.resume();
            resolve({ status: res.statusCode, headers: res.headers, body: "" });
            return;
          }
          const chunks: Buffer[] = [];
          let bytes = 0;
          res.on("data", (chunk) => {
            bytes += chunk.length;
            if (bytes > 1500000) {
              req.destroy(new Error("Página excede 1,5 MB."));
              return;
            }
            chunks.push(chunk);
          });
          res.on("end", () =>
            resolve({
              status: res.statusCode || 0,
              headers: res.headers,
              body: Buffer.concat(chunks).toString("utf8"),
            }),
          );
          res.on("error", reject);
        },
      );
      req.on("error", reject);
      req.on("timeout", () =>
        req.destroy(new Error("Página demorou para responder.")),
      );
      req.end();
    });
    if ([301, 302, 303, 307, 308].includes(result.status)) {
      if (!result.headers.location)
        throw new Error("Redirecionamento sem destino.");
      url = new URL(result.headers.location, url);
      continue;
    }
    if (result.status < 200 || result.status >= 300)
      throw new Error("Página retornou HTTP " + result.status);
    const type = String(result.headers["content-type"] || "");
    if (!/text\/|application\/(json|xhtml\+xml)/i.test(type))
      throw new Error(
        "Esta ferramenta lê páginas e texto, não arquivos binários.",
      );
    if (
      result.headers["content-encoding"] &&
      result.headers["content-encoding"] !== "identity"
    )
      throw new Error("Página enviou uma compactação não solicitada.");
    return { url: url.href, html: result.body, type };
  }
  throw new Error("Redirecionamentos demais.");
}
export async function readWeb(url: string, signal: AbortSignal) {
  const page = await publicPage(url, signal);
  const $ = load(page.html);
  $("script,style,noscript,svg,iframe,form,nav,footer").remove();
  return {
    url: page.url,
    title: $("title").text().slice(0, 200),
    text: ($("main,article").first().text() || $("body").text() || page.html)
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 18000),
    truncated: page.html.length > 18000,
  };
}
export async function searchWeb(query: string, signal: AbortSignal) {
  const page = await publicPage(
    "https://www.bing.com/search?q=" + encodeURIComponent(query),
    signal,
  );
  const $ = load(page.html);
  const results: { title: string; url: string; snippet: string }[] = [];
  $(".b_algo").each((_i, element) => {
    const a = $(element).find("h2 a").first();
    let href = a.attr("href");
    if (!href || results.length >= 6) return;
    try {
      const target = new URL(href, page.url);
      const encoded =
        target.hostname === "www.bing.com"
          ? target.searchParams.get("u")
          : null;
      if (encoded?.startsWith("a1"))
        href = Buffer.from(encoded.slice(2), "base64url").toString("utf8");
      else href = target.href;
      const u = new URL(href);
      if (!["http:", "https:"].includes(u.protocol) || u.username || u.password)
        return;
      results.push({
        title: a.text().trim().slice(0, 200),
        url: u.href,
        snippet: $(element).find(".b_caption p").text().trim().slice(0, 700),
      });
    } catch {}
  });
  if (!results.length)
    throw new Error(
      "A busca pública não retornou resultados ou pediu verificação. Tente fornecer o link da página.",
    );
  return { query, provider: "Bing", results };
}
