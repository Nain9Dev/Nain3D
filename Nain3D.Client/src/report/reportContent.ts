import type { MessageKey } from '../i18n';
import type { EvaluationResult } from '../types/contracts';
import { buildCheckRows, verdictReason, verdictTone, type VerdictTone } from '../viewModel';

type Translate = (key: MessageKey, params?: Record<string, string | number>) => string;

export interface ReportRow {
  label: string;
  figures: string;
  statusText: string;
  passed: boolean;
  severity: 'blocking' | 'advisory';
}

/** Everything the PDF shows, already translated: the renderer only lays it out. */
export interface ReportContent {
  title: string;
  verdictTitle: string;
  verdictLabel: string;
  verdictTone: VerdictTone;
  reason: string;
  profileLabel: string;
  profileName: string;
  fileLabel: string;
  fileName: string;
  sizeLabel: string;
  sizeText: string;
  shaLabel: string;
  sha256: string;
  dateLabel: string;
  dateText: string;
  companyLabel: string;
  company?: string;
  referenceLabel: string;
  reference?: string;
  checksTitle: string;
  columns: { check: string; value: string; result: string };
  rows: ReportRow[];
  note: string;
  generated: string;
}

function dateText(iso: string): string {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(iso);
  return match ? `${match[1]} ${match[2]} UTC` : iso;
}

const clean = (value: string | undefined) => value?.trim() || undefined;

export function composeReport(
  evaluation: EvaluationResult,
  t: Translate,
  formatNumber: (n: number) => string,
  extra: { company?: string; reference?: string },
): ReportContent {
  const bytes = evaluation.asset_size_bytes;
  const sizeText =
    bytes >= 1048576 ? `${formatNumber(Number((bytes / 1048576).toFixed(2)))} MB` : `${formatNumber(Math.max(1, Math.round(bytes / 1024)))} KB`;
  const profileKey = `category.${evaluation.applied_profile.name}` as MessageKey;
  const translatedProfile = t(profileKey);

  return {
    title: t('report.title'),
    verdictTitle: t('report.verdict'),
    verdictLabel: t(`verdict.${evaluation.verdict}` as MessageKey),
    verdictTone: verdictTone(evaluation),
    reason: verdictReason(evaluation, t),
    profileLabel: t('report.profile'),
    profileName: translatedProfile === profileKey ? evaluation.applied_profile.name : translatedProfile,
    fileLabel: t('report.file'),
    fileName: evaluation.asset_name,
    sizeLabel: t('report.size'),
    sizeText,
    shaLabel: t('report.sha'),
    sha256: evaluation.asset_sha256,
    dateLabel: t('report.date'),
    dateText: dateText(evaluation.timestamp_utc),
    companyLabel: t('report.company'),
    company: clean(extra.company),
    referenceLabel: t('report.reference'),
    reference: clean(extra.reference),
    checksTitle: t('report.checks'),
    columns: { check: t('report.colCheck'), value: t('report.colValue'), result: t('report.colResult') },
    rows: buildCheckRows(evaluation, t, formatNumber).map((row) => ({
      label: row.label,
      figures: row.figures,
      passed: row.passed,
      severity: row.severity,
      statusText: row.passed ? t('check.passed') : row.severity === 'advisory' ? t('check.advisory') : t('check.failed'),
    })),
    note: t('report.note'),
    generated: t('report.generated'),
  };
}
