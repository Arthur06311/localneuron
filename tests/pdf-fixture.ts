// Minimal text-only PDF. Standard Helvetica, no embedded images, so reading
// the page content does not need a canvas implementation.
export function textPdf(pages: string[]) {
  for (const text of pages) {
    if (!/^[\x20-\x7E]+$/.test(text) || /[()\\]/.test(text)) throw new Error('O fixture de PDF aceita apenas texto ASCII simples.');
  }
  const fontId = 3 + pages.length * 2;
  const kids = pages.map((_, index) => `${3 + index * 2} 0 R`).join(' ');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`,
  ];
  for (const [index, text] of pages.entries()) {
    const contentId = 4 + index * 2;
    const stream = `BT /F1 24 Tf 72 720 Td (${text}) Tj ET`;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> >>`);
    objects.push(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
  }
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  let body = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(body));
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(body);
  let table = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index < offsets.length; index++) table += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  body += table;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body);
}
