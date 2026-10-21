import { describe, expect, it } from 'vitest';
import { translate } from './i18n';
import type { EvaluationResult } from './types/contracts';
import { buildCheckRows, failedCheckNames } from './viewModel';

const ev = {
  features: {
    triangle_count: 728,
    vertex_count: 400,
    is_watertight: true,
    extents: [3, 5, 3],
    max_dimension_m: 5,
    volume_m3: 0,
    degenerate_faces_count: 0,
  },
  applied_profile: {
    id: 'furniture-chair-01',
    name: 'Mobiliario (Chair)',
    description: '',
    max_triangles: 50000,
    max_dimension_m: 3,
    is_watertight_required: false,
    max_degenerate_faces: 0,
  },
  checks: [
    { name: 'budget_triangles', label: 'x', value: 728, limit: 50000, passed: true, severity: 'blocking', message: '' },
    { name: 'metric_scale', label: 'x', value: '5 m', limit: '<= 3 m', passed: false, severity: 'blocking', message: '' },
    { name: 'integrity_watertight', label: 'x', value: 'Watertight Solid', limit: 'Optional', passed: true, severity: 'advisory', message: '' },
    { name: 'degenerate_faces', label: 'x', value: 0, limit: 0, passed: true, severity: 'blocking', message: '' },
  ],
} as unknown as EvaluationResult;

const es = (key: Parameters<typeof translate>[1], params?: Record<string, string | number>) => translate('es', key, params);
const fmt = (n: number) => new Intl.NumberFormat('es-ES').format(n);

describe('buildCheckRows', () => {
  const rows = buildCheckRows(ev, es, fmt);

  it('localises labels from the check id, not from the API text', () => {
    expect(rows.map((r) => r.label)).toEqual([
      'Presupuesto de triángulos',
      'Extensión física',
      'Estanqueidad',
      'Caras degeneradas',
    ]);
  });

  it('takes figures from the payload without recomputing them', () => {
    expect(rows[0]).toMatchObject({ value: '728', limit: '50.000', passed: true });
    expect(rows[1]).toMatchObject({ value: '5 m', limit: '3 m', passed: false });
    expect(rows[2]).toMatchObject({ value: 'Sólido cerrado', limit: 'Opcional', figures: 'Sólido cerrado · Opcional' });
    expect(rows[0].figures).toBe('728 de 50.000');
  });

  it('keeps the API pass/fail flag and severity', () => {
    expect(rows.map((r) => r.passed)).toEqual([true, false, true, true]);
    expect(rows[2].severity).toBe('advisory');
  });
});

describe('store checks', () => {
  const store = {
    ...ev,
    applied_profile: { ...ev.applied_profile, max_file_mb: 5, max_texture_px: 2048, max_materials: 4, require_uv_and_textures: true },
    features: { ...ev.features, texture_max_side_px: 4096, material_count: 6, has_uv_coordinates: true, textured_material_count: 1 },
    checks: [
      ...ev.checks,
      { name: 'file_size', label: 'x', value: '7.40 MB', limit: '<= 5 MB', passed: false, severity: 'blocking', message: '' },
      { name: 'texture_resolution', label: 'x', value: '4096 px', limit: '<= 2048 px', passed: false, severity: 'blocking', message: '' },
      { name: 'material_budget', label: 'x', value: 6, limit: 4, passed: false, severity: 'blocking', message: '' },
      { name: 'uv_and_textures', label: 'x', value: 'present', limit: 'Required', passed: true, severity: 'blocking', message: '' },
    ],
  } as unknown as EvaluationResult;

  it('localises the new labels and figures from the payload', () => {
    const rows = buildCheckRows({ ...store, asset_size_bytes: 7.4 * 1048576 }, es, fmt);
    const byName = Object.fromEntries(rows.map((r) => [r.name, r]));
    expect(byName.file_size).toMatchObject({ label: 'Peso del archivo', figures: '7,4 MB de 5 MB', passed: false });
    expect(byName.texture_resolution).toMatchObject({ label: 'Resolución de texturas', figures: '4096 px de 2048 px' }); // es-ES does not group four-digit numbers.
    expect(byName.material_budget).toMatchObject({ label: 'Materiales', figures: '6 de 4' });
    expect(byName.uv_and_textures).toMatchObject({ label: 'UV y texturas', figures: 'Presentes', passed: true });
  });

  it('names the failing store checks in the verdict reason', () => {
    expect(failedCheckNames(store, es)).toEqual(['Extensión física', 'Peso del archivo', 'Resolución de texturas', 'Materiales']);
  });
});

describe('failedCheckNames', () => {
  it('lists only failing blocking checks, localised', () => {
    expect(failedCheckNames(ev, es)).toEqual(['Extensión física']);
  });
});
