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
  file_size: 'check.file_size',
  texture_resolution: 'check.texture_resolution',
  material_budget: 'check.material_budget',
  uv_and_textures: 'check.uv_and_textures',
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
      case 'file_size':
        return row(`${formatNumber(Number((evaluation.asset_size_bytes / 1048576).toFixed(2)))} MB`, `${formatNumber(profile.max_file_mb ?? 0)} MB`);
      case 'texture_resolution': {
        const side = features.texture_max_side_px;
        const measurable = side !== null && side !== undefined;
        const value = measurable ? `${formatNumber(side)} px` : t('check.unknown');
        return row(value, `${formatNumber(profile.max_texture_px ?? 0)} px`, measurable ? undefined : value);
      }
      case 'material_budget':
        return row(formatNumber(features.material_count ?? 0), formatNumber(profile.max_materials ?? 0));
      case 'uv_and_textures': {
        const value = check.passed ? t('check.present') : t('check.missing');
        return row(value, value, value);
      }
      default:
        return row(String(check.value), String(check.limit));
    }
  });
}

export function failedCheckNames(evaluation: EvaluationResult, t: Translate): string[] {
  const rows = buildCheckRows(evaluation, t, String);
  return rows.filter((row) => !row.passed && row.severity === 'blocking').map((row) => row.label);
}
