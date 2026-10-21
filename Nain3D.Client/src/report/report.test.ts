import { describe, expect, it } from 'vitest';
import { translate, type Lang, type MessageKey } from '../i18n';
import type { EvaluationResult } from '../types/contracts';
import { composeReport } from './reportContent';
import { renderReport, reportFileName } from './renderReport';
import { textWidth } from './pdf';

const evaluation = {
  asset_sha256: 'f8c3de0e841cdfe1' + '0123456789abcdef'.repeat(3),
  asset_name: 'zapatilla-proveedor.glb',
  asset_size_bytes: 7.4 * 1048576,
  timestamp_utc: '2026-10-21T19:45:12.345+00:00',
  evaluation_duration_ms: 9.4,
  verdict: 'NON_CONFORMANT',
  verdict_summary: '',
  ai_proposal: { predicted_category: 'Mobiliario (Chair)', confidence: 0.79, source: 's', reasoning: null },
  features: {
    triangle_count: 22700,
    vertex_count: 13540,
    is_watertight: false,
    extents: [0.3, 0.15, 0.12],
    max_dimension_m: 0.298,
    volume_m3: 0,
    degenerate_faces_count: 0,
    texture_max_side_px: 4096,
    material_count: 1,
    textured_material_count: 1,
    has_uv_coordinates: true,
    inventory_readable: true,
  },
  applied_profile: {
    id: 'custom-1',
    name: 'Tienda AR',
    description: '',
    max_triangles: 50000,
    max_dimension_m: 2,
    is_watertight_required: false,
    max_degenerate_faces: 0,
    max_file_mb: 5,
    max_texture_px: 2048,
  },
  checks: [
    { name: 'budget_triangles', label: 'x', value: 22700, limit: 50000, passed: true, severity: 'blocking', message: '' },
    { name: 'metric_scale', label: 'x', value: '', limit: '', passed: true, severity: 'blocking', message: '' },
    { name: 'integrity_watertight', label: 'x', value: '', limit: '', passed: true, severity: 'advisory', message: '' },
    { name: 'degenerate_faces', label: 'x', value: 0, limit: 0, passed: true, severity: 'blocking', message: '' },
    { name: 'file_size', label: 'x', value: '', limit: '', passed: false, severity: 'blocking', message: '' },
    { name: 'texture_resolution', label: 'x', value: '', limit: '', passed: false, severity: 'blocking', message: '' },
  ],
} as unknown as EvaluationResult;

const tr = (lang: Lang) => (key: MessageKey, params?: Record<string, string | number>) => translate(lang, key, params);
const fmt = (lang: Lang) => (n: number) => new Intl.NumberFormat(lang === 'es' ? 'es-ES' : 'en-GB').format(n);
const decode = (bytes: Uint8Array) => Array.from(bytes, (b) => String.fromCharCode(b)).join('');

describe('composeReport', () => {
  it('states the verdict, the reasons and the facts in Spanish', () => {
    const r = composeReport(evaluation, tr('es'), fmt('es'), { company: 'Tienda Sol', reference: 'PED-1042' });
    expect(r.verdictLabel).toBe('No conforme');
    expect(r.verdictTone).toBe('bad');
    expect(r.reason).toBe('Incumple: Peso del archivo, Resolución de texturas.');
    expect(r.profileName).toBe('Tienda AR');
    expect(r.fileName).toBe('zapatilla-proveedor.glb');
    expect(r.sizeText).toBe('7,4 MB');
    expect(r.sha256).toHaveLength(64);
    expect(r.dateText).toBe('2026-10-21 19:45 UTC');
    expect(r.company).toBe('Tienda Sol');
    expect(r.reference).toBe('PED-1042');
    const failing = r.rows.filter((row) => !row.passed).map((row) => `${row.label}: ${row.figures}`);
    expect(failing).toEqual(['Peso del archivo: 7,4 MB de 5 MB', 'Resolución de texturas: 4096 px de 2048 px']);
    expect(r.rows.find((row) => !row.passed)?.statusText).toBe('Incumple');
  });

  it('follows the language', () => {
    const r = composeReport(evaluation, tr('en'), fmt('en'), {});
    expect(r.title).toBe('3D conformance report');
    expect(r.verdictLabel).toBe('Non-conformant');
    expect(r.reason).toBe('Fails: File weight, Texture resolution.');
    expect(r.company).toBeUndefined();
  });

  it('leaves out empty optional fields', () => {
    const r = composeReport(evaluation, tr('es'), fmt('es'), { company: '  ', reference: '' });
    expect(r.company).toBeUndefined();
    expect(r.reference).toBeUndefined();
  });
});

describe('renderReport', () => {
  const content = composeReport(evaluation, tr('es'), fmt('es'), { company: 'Tienda Sol', reference: 'PED-1042' });

  it('fits one A4 page: every text starts inside the margins and ends before the right margin', () => {
    const page = renderReport(content);
    expect(page.width).toBe(595);
    expect(page.height).toBe(842);
    for (const t of page.placed) {
      expect(t.x).toBeGreaterThanOrEqual(0);
      expect(t.y).toBeGreaterThan(0);
      expect(t.y).toBeLessThan(842 - 20);
      expect(t.x + textWidth(t.text, t.size, t.font), t.text).toBeLessThanOrEqual(595 - 40 + 0.5);
    }
  });

  it('contains the verdict, the failing limits with their values, the profile, the full hash and the optional fields', () => {
    const text = decode(renderReport(content).build());
    for (const needle of ['No conforme', 'Peso del archivo', '7,4 MB de 5 MB', 'Resoluci\xf3n de texturas', 'Tienda AR', 'Tienda Sol', 'PED-1042', 'zapatilla-proveedor.glb']) {
      expect(text, needle).toContain(needle);
    }
    expect(text).toContain(content.sha256.slice(0, 32));
    expect(text).toContain(content.sha256.slice(32));
  });

  it('still fits when names are very long', () => {
    const long = { ...content, fileName: 'x'.repeat(200) + '.glb', company: 'Empresa '.repeat(30), reference: 'R'.repeat(120) };
    const page = renderReport(long);
    for (const t of page.placed) expect(t.x + textWidth(t.text, t.size, t.font), t.text).toBeLessThanOrEqual(595 - 40 + 0.5);
  });

  it('embeds the model capture when there is one', () => {
    const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]);
    const out = decode(renderReport(content, { data: jpeg, width: 800, height: 450 }).build());
    expect(out).toContain('/Subtype /Image /Width 800 /Height 450');
  });

  it('names the file after the language and the short hash', () => {
    expect(reportFileName(evaluation, tr('es'))).toBe('informe-nain3d-f8c3de0e.pdf');
    expect(reportFileName(evaluation, tr('en'))).toBe('report-nain3d-f8c3de0e.pdf');
  });
});
