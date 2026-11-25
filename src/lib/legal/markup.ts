/**
 * The small writing format of the legal pages, kept deliberately tiny so no HTML is ever stored or injected:
 * an empty line starts a new paragraph, lines that start with "- " make a list, **bold** and `code`.
 */
export type Block = { type: "p"; lines: string[] } | { type: "ul"; items: string[] };

export function parseBlocks(body: string): Block[] {
  const blocks: Block[] = [];
  let current: Block | null = null;
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) {
      current = null;
      continue;
    }
    if (line.startsWith("- ")) {
      if (current?.type !== "ul") blocks.push((current = { type: "ul", items: [] }));
      current.items.push(line.slice(2).trim());
    } else {
      if (current?.type !== "p") blocks.push((current = { type: "p", lines: [] }));
      current.lines.push(line);
    }
  }
  return blocks;
}

export type Inline = { type: "text" | "bold" | "code"; value: string };

export function parseInline(line: string): Inline[] {
  return line
    .split(/(\*\*[^*]+\*\*|`[^`]+`)/)
    .filter(Boolean)
    .map((part): Inline => {
      if (part.length > 4 && part.startsWith("**") && part.endsWith("**"))
        return { type: "bold", value: part.slice(2, -2) };
      if (part.length > 2 && part.startsWith("`") && part.endsWith("`"))
        return { type: "code", value: part.slice(1, -1) };
      return { type: "text", value: part };
    });
}
