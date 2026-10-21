// A tiny PDF 1.4 writer: one page, the three standard fonts (no embedding), filled rectangles, text and one
// embedded JPEG. It has no dependencies and is deterministic: the same calls always give the same bytes.

export type PdfFont = 'regular' | 'bold' | 'mono';
export type Rgb = [number, number, number];

const FONT_KEY: Record<PdfFont, string> = { regular: 'F1', bold: 'F2', mono: 'F3' };
const BASE_FONT: Record<PdfFont, string> = { regular: 'Helvetica', bold: 'Helvetica-Bold', mono: 'Courier' };

// Advance widths (1/1000 em) for ASCII 32..126, from the standard Helvetica metrics.
const REGULAR = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278,
  278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722,
  667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556,
  556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];
const BOLD = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333,
  333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722,
  667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611,
  611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
];

const WIN_ANSI_EXTRA: Record<number, number> = {
  0x20ac: 0x80,
  0x2026: 0x85,
  0x2018: 0x91,
  0x2019: 0x92,
  0x201c: 0x93,
  0x201d: 0x94,
  0x2022: 0x95,
  0x2013: 0x96,
  0x2014: 0x97,
};

/** Text as WinAnsi bytes (what the standard fonts use). Characters the font cannot show become "?". */
export function encodeWinAnsi(text: string): Uint8Array {
  const out: number[] = [];
  for (const char of text) {
    const cp = char.codePointAt(0) as number;
    if (cp >= 0x20 && cp <= 0x7e) out.push(cp);
    else if (cp >= 0xa0 && cp <= 0xff) out.push(cp);
    else if (WIN_ANSI_EXTRA[cp] !== undefined) out.push(WIN_ANSI_EXTRA[cp]);
    else if (cp < 0x20 || cp === 0x7f) out.push(0x20);
    else out.push(0x3f);
  }
  return Uint8Array.from(out);
}

/** Width in points. Accented letters count as their base letter; anything unknown counts as 556. */
export function textWidth(text: string, size: number, font: PdfFont): number {
  if (font === 'mono') return ([...text].length * 600 * size) / 1000;
  const table = font === 'bold' ? BOLD : REGULAR;
  let total = 0;
  for (const char of text) {
    const base = char.normalize('NFD')[0].codePointAt(0) as number;
    total += base >= 32 && base <= 126 ? table[base - 32] : 556;
  }
  return (total * size) / 1000;
}

const num = (n: number) => String(Math.round(n * 1000) / 1000);
const color = ([r, g, b]: Rgb) => `${num(r)} ${num(g)} ${num(b)} rg`;
const escape = (text: string) => text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
const binary = (bytes: Uint8Array) => Array.from(bytes, (b) => String.fromCharCode(b)).join('');
const ascii = (text: string) => Uint8Array.from(text, (c) => c.charCodeAt(0));

interface Picture {
  data: Uint8Array;
  width: number;
  height: number;
}

export interface PlacedText {
  x: number;
  y: number;
  text: string;
  size: number;
  font: PdfFont;
}

export class PdfPage {
  private readonly commands: string[] = [];
  private picture: Picture | null = null;
  /** Every text drawn so far, for layout checks in tests. */
  readonly placed: PlacedText[] = [];

  constructor(
    readonly width: number,
    readonly height: number,
  ) {}

  /** Filled rectangle; (x, y) is the top-left corner measured from the top of the page. */
  rect(x: number, y: number, w: number, h: number, fill: Rgb): void {
    this.commands.push(`${color(fill)} ${num(x)} ${num(this.height - y - h)} ${num(w)} ${num(h)} re f`);
  }

  /** Text whose baseline is at y (from the top of the page). */
  text(x: number, y: number, text: string, style: { size: number; font: PdfFont; color?: Rgb }): void {
    this.placed.push({ x, y, text, size: style.size, font: style.font });
    const fill = style.color ?? [0, 0, 0];
    const shown = binary(encodeWinAnsi(text));
    this.commands.push(`BT /${FONT_KEY[style.font]} ${num(style.size)} Tf ${color(fill)} ${num(x)} ${num(this.height - y)} Td (${escape(shown)}) Tj ET`);
  }

  /** Draws a JPEG (raw file bytes) in the given box. Only one picture per page. */
  image(jpeg: Uint8Array, size: { width: number; height: number }, x: number, y: number, w: number, h: number): void {
    this.picture = { data: jpeg, width: size.width, height: size.height };
    this.commands.push(`q ${num(w)} 0 0 ${num(h)} ${num(x)} ${num(this.height - y - h)} cm /Im1 Do Q`);
  }

  build(): Uint8Array {
    const content = this.commands.join('\n');
    const objects: Uint8Array[][] = [];
    const add = (...parts: (string | Uint8Array)[]) => objects.push(parts.map((p) => (typeof p === 'string' ? ascii(p) : p)));

    const xobject = this.picture ? ' /XObject << /Im1 8 0 R >>' : '';
    add('<< /Type /Catalog /Pages 2 0 R >>');
    add('<< /Type /Pages /Count 1 /Kids [3 0 R] >>');
    add(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(this.width)} ${num(this.height)}] /Contents 4 0 R ` +
        `/Resources << /Font << /F1 5 0 R /F2 6 0 R /F3 7 0 R >>${xobject} >> >>`,
    );
    add(`<< /Length ${content.length} >>\nstream\n`, content, '\nendstream');
    for (const font of ['regular', 'bold', 'mono'] as PdfFont[]) {
      add(`<< /Type /Font /Subtype /Type1 /BaseFont /${BASE_FONT[font]} /Encoding /WinAnsiEncoding >>`);
    }
    if (this.picture) {
      const { data, width, height } = this.picture;
      add(
        `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${data.length} >>\nstream\n`,
        data,
        '\nendstream',
      );
    }

    const chunks: Uint8Array[] = [ascii('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n')];
    const offsets: number[] = [];
    let position = chunks[0].length;
    objects.forEach((parts, i) => {
      offsets.push(position);
      const wrapped = [ascii(`${i + 1} 0 obj\n`), ...parts, ascii('\nendobj\n')];
      for (const piece of wrapped) {
        chunks.push(piece);
        position += piece.length;
      }
    });
    const xref =
      `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` +
      offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('') +
      `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${position}\n%%EOF\n`;
    chunks.push(ascii(xref));

    const out = new Uint8Array(chunks.reduce((sum, c) => sum + c.length, 0));
    let at = 0;
    for (const chunk of chunks) {
      out.set(chunk, at);
      at += chunk.length;
    }
    return out;
  }
}
