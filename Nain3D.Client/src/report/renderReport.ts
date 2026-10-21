import type { MessageKey } from '../i18n';
import type { EvaluationResult } from '../types/contracts';
import { PdfPage, textWidth, type PdfFont, type Rgb } from './pdf';
import type { ReportContent } from './reportContent';

const W = 595;
const H = 842;
const M = 40;
const CONTENT = W - 2 * M;

const BLACK: Rgb = [0.114, 0.114, 0.106];
const WHITE: Rgb = [1, 1, 1];
const GREEN: Rgb = [0.5, 1, 0];
const RED: Rgb = [0.769, 0, 0.102];
const AMBER: Rgb = [1, 0.824, 0.247];
const PAPER: Rgb = [0.929, 0.945, 0.965];
const GRAY: Rgb = [0.35, 0.4, 0.48];
const LINE: Rgb = [0.78, 0.82, 0.89];
const GREEN_INK: Rgb = [0.18, 0.42, 0];

export interface Picture {
  data: Uint8Array;
  width: number;
  height: number;
}

/** Wraps `text` to `width` points, breaking long words, and ends the last allowed line with an ellipsis. */
export function fit(text: string, width: number, size: number, font: PdfFont, maxLines: number): string[] {
  const lines: string[] = [];
  let current = '';
  const fits = (s: string) => textWidth(s, size, font) <= width;
  const push = (s: string) => lines.push(s);
  for (const word of text.split(/\s+/).filter(Boolean)) {
    let rest = word;
    while (!fits(rest)) {
      // Hard-break a word that is wider than the line.
      let cut = rest.length - 1;
      while (cut > 1 && !fits(rest.slice(0, cut))) cut -= 1;
      if (current) {
        push(current);
        current = '';
      }
      push(rest.slice(0, cut));
      rest = rest.slice(cut);
    }
    const candidate = current ? `${current} ${rest}` : rest;
    if (fits(candidate)) current = candidate;
    else {
      push(current);
      current = rest;
    }
  }
  if (current) push(current);

  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  let last = kept[maxLines - 1];
  while (last.length > 1 && !fits(`${last}…`)) last = last.slice(0, -1);
  kept[maxLines - 1] = `${last}…`;
  return kept;
}

export function reportFileName(evaluation: EvaluationResult, t: (key: MessageKey) => string): string {
  return `${t('report.filePrefix')}-${evaluation.asset_sha256.slice(0, 8)}.pdf`;
}

export function renderReport(content: ReportContent, picture?: Picture): PdfPage {
  const page = new PdfPage(W, H);

  // Header
  page.rect(0, 0, W, 84, BLACK);
  page.text(M, 32, 'NAIN3D GATEWAY', { size: 9, font: 'mono', color: GREEN });
  page.text(M, 62, fit(content.title, CONTENT, 22, 'bold', 1)[0], { size: 22, font: 'bold', color: WHITE });

  // Verdict
  const tone = { good: { fill: GREEN, ink: BLACK }, warn: { fill: AMBER, ink: BLACK }, bad: { fill: RED, ink: WHITE } }[content.verdictTone];
  page.rect(M, 104, CONTENT, 82, tone.fill);
  page.text(M + 18, 126, content.verdictTitle.toUpperCase(), { size: 8, font: 'mono', color: tone.ink });
  page.text(M + 18, 150, fit(content.verdictLabel, CONTENT - 36, 30, 'bold', 1)[0], { size: 30, font: 'bold', color: tone.ink });
  fit(content.reason, CONTENT - 36, 11.5, 'regular', 2).forEach((line, i) =>
    page.text(M + 18, 170 + i * 14, line, { size: 11.5, font: 'regular', color: tone.ink }),
  );

  // Facts and capture
  const colWidth = picture ? 290 : CONTENT;
  let y = 214;
  const facts: [string, string, PdfFont][] = [
    [content.fileLabel, content.fileName, 'regular'],
    [content.sizeLabel, content.sizeText, 'regular'],
    [content.profileLabel, content.profileName, 'bold'],
    [content.dateLabel, content.dateText, 'regular'],
  ];
  if (content.company) facts.push([content.companyLabel, content.company, 'regular']);
  if (content.reference) facts.push([content.referenceLabel, content.reference, 'regular']);
  for (const [label, value, font] of facts) {
    page.text(M, y, label.toUpperCase(), { size: 7.5, font: 'mono', color: GRAY });
    const lines = fit(value, colWidth, 11, font, 2);
    lines.forEach((line, i) => page.text(M, y + 13 + i * 13, line, { size: 11, font, color: BLACK }));
    y += 22 + lines.length * 13;
  }
  let bottom = y;
  if (picture) {
    const box = { x: M + 315, y: 214, w: 200, h: 140 };
    page.rect(box.x - 1, box.y - 1, box.w + 2, box.h + 2, LINE);
    const scale = Math.min(box.w / picture.width, box.h / picture.height);
    const w = picture.width * scale;
    const h = picture.height * scale;
    page.image(picture.data, picture, box.x + (box.w - w) / 2, box.y + (box.h - h) / 2, w, h);
    bottom = Math.max(bottom, box.y + box.h + 8);
  }

  // Checks table
  y = bottom + 10;
  page.text(M, y, content.checksTitle, { size: 13, font: 'bold', color: BLACK });
  y += 10;
  page.rect(M, y, CONTENT, 22, PAPER);
  const cols = { check: M + 8, value: M + 225, result: M + 425 };
  page.text(cols.check, y + 14.5, content.columns.check.toUpperCase(), { size: 7.5, font: 'mono', color: GRAY });
  page.text(cols.value, y + 14.5, content.columns.value.toUpperCase(), { size: 7.5, font: 'mono', color: GRAY });
  page.text(cols.result, y + 14.5, content.columns.result.toUpperCase(), { size: 7.5, font: 'mono', color: GRAY });
  y += 22;
  for (const row of content.rows) {
    const mark = row.passed ? GREEN_INK : row.severity === 'advisory' ? [0.6, 0.45, 0] as Rgb : RED;
    page.text(cols.check, y + 17, fit(row.label, 205, 10.5, 'bold', 1)[0], { size: 10.5, font: 'bold', color: BLACK });
    page.text(cols.value, y + 17, fit(row.figures, 190, 10, 'regular', 1)[0], { size: 10, font: 'regular', color: row.passed ? BLACK : RED });
    page.rect(cols.result, y + 9.5, 8, 8, mark);
    page.text(cols.result + 14, y + 17, fit(row.statusText, 80, 10, 'bold', 1)[0], { size: 10, font: 'bold', color: mark });
    page.rect(M, y + 25, CONTENT, 0.6, LINE);
    y += 26;
  }

  // Fingerprint
  y += 14;
  page.text(M, y, content.shaLabel.toUpperCase(), { size: 7.5, font: 'mono', color: GRAY });
  page.text(M, y + 13, content.sha256.slice(0, 32), { size: 10, font: 'mono', color: BLACK });
  page.text(M, y + 26, content.sha256.slice(32), { size: 10, font: 'mono', color: BLACK });

  // Footer
  fit(content.note, CONTENT, 8.5, 'regular', 3).forEach((line, i) => page.text(M, H - 74 + i * 11, line, { size: 8.5, font: 'regular', color: GRAY }));
  page.rect(M, H - 36, CONTENT, 0.6, LINE);
  page.text(M, H - 22, fit(content.generated, CONTENT, 8, 'mono', 1)[0], { size: 8, font: 'mono', color: GRAY });
  return page;
}
