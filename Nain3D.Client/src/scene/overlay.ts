import type { EvaluationResult } from '../types/contracts';

export interface ScaleOverlay {
  /** Bounding-box size reported by the API (`features.extents`). */
  extents: [number, number, number];
  /** Profile limit reported by the API (`applied_profile.max_dimension_m`). */
  limit: number;
  /** True when the API's `metric_scale` check did not pass (or is absent: fail-closed). */
  exceeds: boolean;
  tickStep: number;
  /** Ruler marks in metres, from `tickStep` up to the larger of model height and limit. */
  ticks: number[];
}

const NICE_STEPS = [0.1, 0.25, 0.5, 1, 2, 5];

/**
 * Describes what to draw for the scale story. Numbers come from the API payload; the pass/fail flag
 * is the API's own check result, so the presentation layer never re-decides conformance.
 */
export function buildScaleOverlay(evaluation: EvaluationResult): ScaleOverlay {
  const check = evaluation.checks.find((c) => c.name === 'metric_scale');
  const { extents } = evaluation.features;
  const limit = evaluation.applied_profile.max_dimension_m;
  const span = Math.max(limit, evaluation.features.max_dimension_m);
  const tickStep = NICE_STEPS.find((step) => span / step <= 8) ?? NICE_STEPS[NICE_STEPS.length - 1];
  const count = Math.max(1, Math.ceil(span / tickStep - 1e-9));
  const ticks = Array.from({ length: count }, (_, i) => Math.round((i + 1) * tickStep * 1000) / 1000);
  return { extents, limit, exceeds: !check || !check.passed, tickStep, ticks };
}
