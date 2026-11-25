import JSZip from "jszip";

/** Small, synthetic Office files for tests: only the parts a reader needs. */
const escapeXml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function pack(parts: Record<string, string>): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", "<Types/>");
  for (const [path, content] of Object.entries(parts)) zip.file(path, content, { createFolders: false });
  return zip.generateAsync({ type: "uint8array" });
}

const relationships = (targets: string[]) =>
  `<Relationships>${targets
    .map((target, i) => `<Relationship Id="rId${i + 1}" Type="part" Target="${target}"/>`)
    .join("")}</Relationships>`;

export const officeFile = {
  word(paragraphs: { text: string; heading?: boolean }[], extra: Record<string, string> = {}) {
    const body = paragraphs
      .map((p) => {
        const style = p.heading ? '<w:pPr><w:pStyle w:val="Heading1"/></w:pPr>' : "";
        return `<w:p>${style}<w:r><w:t xml:space="preserve">${escapeXml(p.text)}</w:t></w:r></w:p>`;
      })
      .join("");
    return pack({ "word/document.xml": `<w:document><w:body>${body}</w:body></w:document>`, ...extra });
  },

  spreadsheet(sheets: { name: string; rows: (string | number)[][] }[]) {
    const shared: string[] = [];
    const cell = (value: string | number) => {
      if (typeof value === "number") return `<c><v>${value}</v></c>`;
      shared.push(value);
      return `<c t="s"><v>${shared.length - 1}</v></c>`;
    };
    const parts: Record<string, string> = {};
    sheets.forEach((sheet, i) => {
      const rows = sheet.rows.map((row) => `<row>${row.map(cell).join("")}</row>`).join("");
      parts[`xl/worksheets/sheet${i + 1}.xml`] = `<worksheet><sheetData>${rows}</sheetData></worksheet>`;
    });
    parts["xl/workbook.xml"] = `<workbook><sheets>${sheets
      .map((s, i) => `<sheet name="${escapeXml(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
      .join("")}</sheets></workbook>`;
    parts["xl/_rels/workbook.xml.rels"] = relationships(sheets.map((_, i) => `worksheets/sheet${i + 1}.xml`));
    parts["xl/sharedStrings.xml"] = `<sst>${shared.map((s) => `<si><t>${escapeXml(s)}</t></si>`).join("")}</sst>`;
    return pack(parts);
  },

  slides(slides: string[][]) {
    const parts: Record<string, string> = {};
    slides.forEach((lines, i) => {
      const text = lines.map((line) => `<a:p><a:r><a:t>${escapeXml(line)}</a:t></a:r></a:p>`).join("");
      parts[`ppt/slides/slide${i + 1}.xml`] = `<p:sld>${text}</p:sld>`;
    });
    parts["ppt/presentation.xml"] = `<p:presentation><p:sldIdLst>${slides
      .map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 1}"/>`)
      .join("")}</p:sldIdLst></p:presentation>`;
    parts["ppt/_rels/presentation.xml.rels"] = relationships(slides.map((_, i) => `slides/slide${i + 1}.xml`));
    return pack(parts);
  },
};
