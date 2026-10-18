import type { MessageKey } from './i18n';
import type { CheckSeverity, EvaluationResult } from './types/contracts';

type Translate = (key: MessageKey, params?: Record<string, string | number>) => string;

export interface CheckRow {
  name: string;
  label: string;
  value: string;
  limit: string;
  /** Ready-to-show "value against limit" text. */
  figures: string;
  passed: boolean;
  severity: CheckSeverity;
}

const LABEL_KEYS: Record<string, MessageKey> = {
  budget_triangles: 'check.budget_triangles',
  metric_scale: 'check.metric_scale',
  integrity_watertight: 'check.integrity_watertight',
  degenerate_faces: 'check.degenerate_faces',
};

/**
 * Rows for the checklist. Figures are read from `features` and `applied_profile` as delivered by the
 * API (formatting only); pass/fail and severity are the API's own check results.
 */
export function buildCheckRows(
  evaluation: EvaluationResult,
  t: Translate,
  formatNumber: (n: number) => string,
): CheckRow[] {
  const { features, applied_profile: profile } = evaluation;
  const against = (value: string, limit: string) => t('check.valueOfLimit', { value, limit });
  return evaluation.checks.map((check) => {
    const base = { name: check.name, passed: check.passed, severity: check.severity };
    const label = LABEL_KEYS[check.name] ? t(LABEL_KEYS[check.name]) : check.label;
    const row = (value: string, limit: string, figures = against(value, limit)) => ({
      ...base,
      label,
      value,
      limit,
      figures,
    });
    switch (check.name) {
      case 'budget_triangles':
        return row(formatNumber(features.triangle_count), formatNumber(profile.max_triangles));
      case 'metric_scale':
        return row(`${formatNumber(features.max_dimension_m)} m`, `${formatNumber(profile.max_dimension_m)} m`);
      case 'integrity_watertight': {
        const value = features.is_watertight ? t('check.watertightYes') : t('check.watertightNo');
        const limit = profile.is_watertight_required ? t('check.watertightRequired') : t('check.watertightOptional');
        return row(value, limit, t('check.valueWithRule', { value, rule: limit }));
      }
      case 'degenerate_faces':
        return row(formatNumber(features.degenerate_faces_count), formatNumber(profile.max_degenerate_faces));
      default:
        return row(String(check.value), String(check.limit));
    }
  });
}

export function failedCheckNames(evaluation: EvaluationResult, t: Translate): string[] {
  const rows = buildCheckRows(evaluation, t, String);
  return rows.filter((row) => !row.passed && row.severity === 'blocking').map((row) => row.label);
}
