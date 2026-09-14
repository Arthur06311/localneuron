import { extname } from "node:path";
import { unzipSync, strFromU8 } from "fflate";
import { load } from "cheerio";
import ExcelJS from "exceljs";
import { Document, Packer, Paragraph, HeadingLevel } from "docx";
import { createRequire } from "node:module";
const PptxGenJS = createRequire(import.meta.url)("pptxgenjs");
export type Page = { location: string; text: string };
export function checkedZip(data: Buffer) {
  let total = 0;
  return unzipSync(data, {
    filter: (file) => {
      total += file.originalSize;
      if (file.originalSize > 8 * 1024 ** 2 || total > 40 * 1024 ** 2)
        throw Error("Documento compactado excede o limite de leitura.");
      return true;
    },
  });
}
export async function extractDocument(
  name: string,
  data: Buffer,
): Promise<Page[]> {
  if (!data.length || data.length > 12 * 1024 ** 2)
    throw Error("Importe arquivos de até 12 MiB.");
  const ext = extname(name).toLowerCase();
  let pages: Page[] = [];
  if (ext === ".pdf") {
    const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const task = getDocument({
      data: new Uint8Array(data),
      useSystemFonts: true,
    });
    const pdf = await task.promise;
    try {
      if (pdf.numPages > 200)
        throw Error("Limite de 200 páginas por documento.");
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        pages.push({
          location: `Página ${i}`,
          text: content.items.map((v: any) => v.str || "").join(" "),
        });
        page.cleanup();
      }
    } finally {
      await task.destroy();
    }
  } else if (ext === ".xlsx") {
    checkedZip(data);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(data as any);
    workbook.eachSheet((sheet) => {
      sheet.eachRow((row, index) => {
        if (pages.length >= 10000)
          throw Error("Planilha excede 10.000 linhas.");
        pages.push({
          location: `${sheet.name} · linha ${index}`,
          text:
            row.values instanceof Array
              ? row.values
                  .map((v: any) =>
                    typeof v === "object" && v !== null
                      ? v.text ||
                        v.result ||
                        v.richText?.map((r: any) => r.text).join("") ||
                        ""
                      : String(v ?? ""),
                  )
                  .join(" | ")
              : "",
        });
      });
    });
  } else if (ext === ".docx") {
    const files = checkedZip(data),
      xml = files["word/document.xml"];
    if (!xml) throw Error("Documento DOCX inválido.");
    const $ = load(strFromU8(xml), { xml: true });
    $("w\\:p").each((i, p) => {
      pages.push({
        location: `Parágrafo ${i + 1}`,
        text: $(p).find("w\\:t").text(),
      });
    });
  } else if (
    [
      ".txt",
      ".md",
      ".csv",
      ".json",
      ".js",
      ".ts",
      ".tsx",
      ".jsx",
      ".py",
      ".html",
      ".css",
      ".sql",
      ".yaml",
      ".yml",
      ".rs",
      ".go",
      ".java",
      ".c",
      ".cpp",
      ".h",
    ].includes(ext)
  ) {
    const text = data.toString("utf8");
    if (text.includes("\0")) throw Error("Arquivo binário não suportado.");
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 20)
      pages.push({
        location: `Linhas ${i + 1}–${Math.min(i + 20, lines.length)}`,
        text: lines.slice(i, i + 20).join("\n"),
      });
  } else throw Error("Use PDF, DOCX, XLSX, CSV, texto ou arquivos de código.");
  pages = pages
    .filter((p) => p.text.trim())
    .flatMap((p) => {
      const parts = [];
      for (let i = 0; i < p.text.length; i += 1800)
        parts.push({ ...p, text: p.text.slice(i, i + 2000) });
      return parts;
    });
  if (!pages.length)
    throw Error(
      "Nenhum texto encontrado. PDFs digitalizados precisam de OCR antes da importação.",
    );
  if (
    pages.length > 3000 ||
    pages.reduce((n, p) => n + p.text.length, 0) > 2 * 1024 ** 2
  )
    throw Error("Documento excede o limite de texto; divida o arquivo.");
  return pages;
}
const words = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .match(/[\p{L}\p{N}_]{3,}/gu) || [];
export function retrieve(
  documents: { id: string; name: string; pages: Page[] }[],
  query: string,
  limit = 6,
) {
  const terms = [...new Set(words(query))];
  return documents
    .flatMap((d) =>
      d.pages.map((p, i) => {
        const tokens = words(p.text),
          set = new Set(tokens);
        const score = terms.reduce(
          (n, t) =>
            n +
            (set.has(t)
              ? 1 + Math.log(1 + tokens.filter((v) => v === t).length)
              : 0),
          0,
        );
        return {
          document: d.id,
          name: d.name,
          location: p.location,
          text: p.text,
          score,
          citation: `${d.id.slice(0, 8)}:${i + 1}`,
        };
      }),
    )
    .filter((p) => p.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
export async function exportDocument(
  title: string,
  body: string,
  format: string,
) {
  if (format === "docx") {
    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({ text: title, heading: HeadingLevel.TITLE }),
            ...body
              .split("\n")
              .map(
                (text) =>
                  new Paragraph({
                    text: text.replace(/^#+\s/, ""),
                    ...(text.startsWith("#")
                      ? { heading: HeadingLevel.HEADING_1 }
                      : {}),
                  }),
              ),
          ],
        },
      ],
    });
    return {
      buffer: await Packer.toBuffer(doc),
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ext: "docx",
    };
  }
  if (format === "xlsx") {
    const book = new ExcelJS.Workbook(),
      sheet = book.addWorksheet("Conteúdo");
    for (const line of body.split("\n").slice(0, 10000)) {
      if (/^\s*\|?[-: ]+\|[-|: ]+$/.test(line)) continue;
      const cells = line.includes("\t")
        ? line.split("\t")
        : line.includes("|")
          ? line.replace(/^\||\|$/g, "").split("|")
          : line.split(";");
      sheet.addRow(cells.map((c) => c.trim()));
    }
    sheet.columns.forEach((c) => (c.width = 32));
    sheet.getRow(1).font = { bold: true };
    return {
      buffer: Buffer.from(await book.xlsx.writeBuffer()),
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ext: "xlsx",
    };
  }
  if (format === "pptx") {
    const deck = new PptxGenJS();
    deck.layout = "LAYOUT_WIDE";
    deck.author = "LocalNeuron";
    const sections = body
      .split(/\n(?=##? )|\n---+\n/)
      .filter(Boolean)
      .slice(0, 40);
    for (const section of sections) {
      const [heading, ...lines] = section.split("\n");
      const slide = deck.addSlide();
      slide.background = { color: "10141C" };
      slide.addText(heading.replace(/^#+\s*/, ""), {
        x: 0.6,
        y: 0.5,
        w: 12,
        h: 1,
        fontSize: 28,
        color: "FFFFFF",
        bold: true,
        breakLine: true,
      });
      slide.addText(lines.join("\n").slice(0, 2500), {
        x: 0.6,
        y: 1.7,
        w: 12,
        h: 5,
        fontSize: 18,
        color: "D9E0EC",
        breakLine: true,
        fit: "shrink",
      });
    }
    return {
      buffer: Buffer.from(
        (await deck.write({ outputType: "nodebuffer" })) as Buffer,
      ),
      type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      ext: "pptx",
    };
  }
  return {
    buffer: Buffer.from(body),
    type: "text/markdown; charset=utf-8",
    ext: "md",
  };
}
