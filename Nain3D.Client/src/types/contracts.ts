export type ConformanceVerdict =
  | 'CONFORMANT'
  | 'CONFORMANT_WITH_FINDINGS'
  | 'NON_CONFORMANT'
  | 'INCOMPLETE';

export type CheckSeverity = 'blocking' | 'advisory';

export interface GeometricFeatures {
  triangle_count: number;
  vertex_count: number;
  is_watertight: boolean;
  extents: [number, number, number];
  max_dimension_m: number;
  volume_m3: number;
  degenerate_faces_count: number;
  /** Inventory for the optional store checks (absent in payloads from older API versions). */
  texture_max_side_px?: number | null;
  material_count?: number;
  textured_material_count?: number;
  has_uv_coordinates?: boolean;
  inventory_readable?: boolean;
}

export interface CheckResult {
  name: string;
  label: string;
  value: unknown;
  limit: unknown;
  passed: boolean;
  severity: CheckSeverity;
  message: string;
}

export interface AiProposal {
  predicted_category: string;
  confidence: number;
  source: string;
  reasoning: string | null;
}

export interface ProfileDefinition {
  id: string;
  name: string;
  description: string;
  max_triangles: number;
  max_dimension_m: number;
  is_watertight_required: boolean;
  max_degenerate_faces: number;
  /** Optional store limits: a profile that leaves them out runs only the four original checks. */
  max_file_mb?: number | null;
  max_texture_px?: number | null;
  max_materials?: number | null;
  require_uv_and_textures?: boolean;
}

export interface EvaluationResult {
  asset_sha256: string;
  asset_name: string;
  asset_size_bytes: number;
  features: GeometricFeatures;
  ai_proposal: AiProposal;
  applied_profile: ProfileDefinition;
  checks: CheckResult[];
  verdict: ConformanceVerdict;
  verdict_summary: string;
  evaluation_duration_ms: number;
  timestamp_utc: string;
}

export interface SampleAsset {
  id: string;
  name: string;
  category: string;
  expected_verdict: ConformanceVerdict;
  description: string;
}
