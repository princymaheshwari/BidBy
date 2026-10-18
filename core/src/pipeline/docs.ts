// F3: matching local documents to an obligation's required documents. Pure, so it is unit-tested.
// The tool schema has no "missing" field, so code decides which required documents have no file.

const STOP = new Set(["the", "and", "for", "your", "with", "from", "copy", "form", "of", "an", "or", "to", "md", "pdf"]);

/** Lowercase words of a document name or file name, without years, numbers or filler words. */
export function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/, "")
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2 && !/^\d+$/.test(t) && !STOP.has(t));
}

const basename = (path: string) => path.replace(/^.*[\\/]/, "");

/** Whether a file satisfies a required document. A blank form is not the signed or completed form. */
export function covers(requiredDoc: string, file: string): boolean {
  const need = new Set(tokens(requiredDoc));
  if (need.size === 0) return false;
  const have = new Set(tokens(basename(file)));
  const overlap = [...need].filter((t) => have.has(t)).length;
  if (overlap < Math.min(2, need.size)) return false;
  return !(/\b(signed|completed)\b/i.test(requiredDoc) && have.has("blank"));
}

/** Each required document with the found file that satisfies it, or null. */
export function docStatus(requiredDocs: string[], foundFiles: string[]): { doc: string; file: string | null }[] {
  return requiredDocs.map((doc) => ({ doc, file: foundFiles.find((f) => covers(doc, f)) ?? null }));
}

/** A blank copy of a form the student must sign or complete, if one was found (e.g. "Worksheet (blank).pdf"). */
export function blankFor(requiredDoc: string, foundFiles: string[]): string | null {
  if (!/\b(signed|completed)\b/i.test(requiredDoc)) return null;
  const unsigned = requiredDoc.replace(/\b(signed|completed)\b/gi, "");
  return foundFiles.find((f) => tokens(basename(f)).includes("blank") && covers(unsigned, f)) ?? null;
}

export function missingDocs(requiredDocs: string[], foundFiles: string[]): string[] {
  return docStatus(requiredDocs, foundFiles).filter((d) => !d.file).map((d) => d.doc);
}

/** Keeps only files that really exist (as "docs/<name>"); the agent must never invent a document. */
export function keepExisting(found: string[], available: string[]): { kept: string[]; dropped: string[] } {
  const names = new Set(available);
  const kept: string[] = [];
  const dropped: string[] = [];
  for (const f of found) {
    const name = basename(f);
    if (names.has(name)) {
      if (!kept.includes(`docs/${name}`)) kept.push(`docs/${name}`);
    } else dropped.push(f);
  }
  return { kept, dropped };
}
