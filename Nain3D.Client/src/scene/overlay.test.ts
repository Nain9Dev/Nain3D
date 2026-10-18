import { describe, expect, it } from 'vitest';
import type { EvaluationResult } from '../types/contracts';
import { buildScaleOverlay } from './overlay';

function evaluation(scalePassed: boolean, extents: [number, number, number], limit: number): EvaluationResult {
  return {
    asset_sha256: 'x',
    asset_name: 'a.glb',
    asset_size_bytes: 1,
    features: {
      triangle_count: 10,
      vertex_count: 10,
      is_watertight: true,
      extents,
      max_dimension_m: Math.max(...extents),
      volume_m3: 1,
      degenerate_faces_count: 0,
    },
    ai_proposal: { predicted_category: 'Monitor', confidence: 0.9, source: 's', reasoning: null },
    applied_profile: {
      id: 'p',
      name: 'Monitor',
      description: '',
      max_triangles: 100,
      max_dimension_m: limit,
      is_watertight_required: false,
      max_degenerate_faces: 0,
    },
    checks: [
      { name: 'metric_scale', label: '', value: '', limit: '', passed: scalePassed, severity: 'blocking', message: '' },
    ],
    verdict: scalePassed ? 'CONFORMANT' : 'NON_CONFORMANT',
    verdict_summary: '',
    evaluation_duration_ms: 7,
    timestamp_utc: '',
  };
}

describe('buildScaleOverlay', () => {
  it('flags an oversized model using the API verdict, not its own comparison', () => {
    const o = buildScaleOverlay(evaluation(false, [3, 5, 3], 3));
    expect(o.exceeds).toBe(true);
    expect(o.extents).toEqual([3, 5, 3]);
    expect(o.limit).toBe(3);
  });

  it('trusts the check result even if the numbers looked fine', () => {
    expect(buildScaleOverlay(evaluation(false, [1, 1, 1], 3)).exceeds).toBe(true);
    expect(buildScaleOverlay(evaluation(true, [9, 9, 9], 3)).exceeds).toBe(false);
  });

  it('fails closed when the scale check is missing', () => {
    const ev = evaluation(true, [1, 1, 1], 3);
    ev.checks = [];
    expect(buildScaleOverlay(ev).exceeds).toBe(true);
  });

  it('chooses a readable ruler step covering the larger of model and limit', () => {
    const o = buildScaleOverlay(evaluation(false, [3, 5, 3], 3));
    expect(o.tickStep).toBe(1);
    expect(o.ticks[0]).toBe(1);
    expect(o.ticks[o.ticks.length - 1]).toBeGreaterThanOrEqual(5);
    const small = buildScaleOverlay(evaluation(true, [0.9, 0.7, 0.2], 2.5));
    expect(small.tickStep).toBe(0.5);
  });
});
