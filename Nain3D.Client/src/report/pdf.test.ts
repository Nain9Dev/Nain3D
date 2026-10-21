import { describe, expect, it } from 'vitest';
import { PdfPage, encodeWinAnsi, textWidth } from './pdf';

const latin1 = (bytes: Uint8Array) => Array.from(bytes, (b) => String.fromCharCode(b)).join('');

function sample(): PdfPage {
  const page = new PdfPage(595, 842);
  page.rect(40, 40, 200, 30, [0.5, 1, 0]);
  page.text(48, 60, 'Veredicto: Conforme (100 % ok)', { size: 14, font: 'bold' });
  page.text(48, 90, 'Peso: 7,4 MB \\ ñ á', { size: 10, font: 'regular', color: [0.8, 0, 0.1] });
  return page;
}

describe('encodeWinAnsi', () => {
  it('maps Spanish letters and punctuation to their WinAnsi codes', () => {
    expect(Array.from(encodeWinAnsi('ñÑáéíóú¿¡·«»'))).toEqual([0xf1, 0xd1, 0xe1, 0xe9, 0xed, 0xf3, 0xfa, 0xbf, 0xa1, 0xb7, 0xab, 0xbb]);
  });

  it('maps typographic punctuation and replaces what the font cannot show', () => {
    expect(Array.from(encodeWinAnsi('–—…€'))).toEqual([0x96, 0x97, 0x85, 0x80]);
    expect(latin1(encodeWinAnsi('✓ 数'))).toBe('? ?');
  });
});

describe('textWidth', () => {
  it('measures Helvetica text in points', () => {
    expect(textWidth('iii', 10, 'regular')).toBeCloseTo((222 * 3 * 10) / 1000);
    expect(textWidth('A', 10, 'bold')).toBeGreaterThan(textWidth('A', 10, 'regular'));
    expect(textWidth('0000', 10, 'mono')).toBeCloseTo(24);
  });

  it('measures an accented letter like its base letter', () => {
    expect(textWidth('á', 12, 'regular')).toBe(textWidth('a', 12, 'regular'));
  });
});

describe('PdfPage', () => {
  const bytes = sample().build();
  const text = latin1(bytes);

  it('is a one-page PDF 1.4 with the base fonts and no external resources', () => {
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(text).toContain('/Type /Pages /Count 1');
    expect(text).toContain('/MediaBox [0 0 595 842]');
    for (const font of ['Helvetica', 'Helvetica-Bold', 'Courier']) expect(text).toContain(`/BaseFont /${font}`);
    expect(text).not.toMatch(/\/URI|\/JavaScript|\/Launch/);
  });

  it('has a cross-reference table whose offsets point at the objects', () => {
    const startxref = Number(/startxref\s+(\d+)/.exec(text)![1]);
    expect(text.slice(startxref, startxref + 4)).toBe('xref');
    const entries = [...text.slice(startxref).matchAll(/(\d{10}) 00000 n /g)].map((m) => Number(m[1]));
    expect(entries.length).toBeGreaterThanOrEqual(6);
    entries.forEach((offset, i) => expect(text.slice(offset, offset + 8)).toMatch(new RegExp(`^${i + 1} 0 obj`)));
  });

  it('writes the text with escaped parentheses and WinAnsi bytes, flipping y to PDF coordinates', () => {
    expect(text).toContain('(Veredicto: Conforme \\(100 % ok\\)) Tj');
    expect(text).toContain('\\\\ \xf1 \xe1'); // The backslash is escaped; n-tilde and a-acute are single bytes.
    expect(text).toContain('48 782 Td'); // y = 842 - 60
  });

  it('is byte-for-byte reproducible', () => {
    expect(Array.from(sample().build())).toEqual(Array.from(bytes));
  });

  it('embeds a JPEG as an image XObject drawn at the requested box', () => {
    const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]);
    const page = sample();
    page.image(jpeg, { width: 640, height: 360 }, 40, 100, 320, 180);
    const out = latin1(page.build());
    expect(out).toContain('/Subtype /Image /Width 640 /Height 360');
    expect(out).toContain('/Filter /DCTDecode');
    expect(out).toContain('/Length 4');
    expect(out).toContain('320 0 0 180 40 562 cm'); // y = 842 - 100 - 180
    expect(out).toContain('/Im1 Do');
  });
});
