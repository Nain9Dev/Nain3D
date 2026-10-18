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

describe('failedCheckNames', () => {
  it('lists only failing blocking checks, localised', () => {
    expect(failedCheckNames(ev, es)).toEqual(['Extensión física']);
  });
});
