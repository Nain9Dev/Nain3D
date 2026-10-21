import type {
  CheckResult,
  CheckSeverity,
  ConformanceVerdict,
  EvaluationResult,
  GeometricFeatures,
  ProfileDefinition,
  SampleAsset,
  AiProposal,
} from '../types/contracts';
import { analyzeGlbMesh, type MeshAnalysis } from './glbMesh';
import { readInventory } from './glbInventory';
import { validateProfile } from '../profiles/validateProfile';

export const PROFILES: Record<string, ProfileDefinition> = {
  Monitor: {
    id: 'monitor-std-01',
    name: 'Monitor',
    description: 'Electronic visual displays, monitors and screens.',
    max_triangles: 25000,
    max_dimension_m: 2.5,
    is_watertight_required: false,
    max_degenerate_faces: 0,
  },
  'Mobiliario (Chair)': {
    id: 'furniture-chair-01',
    name: 'Mobiliario (Chair)',
    description: 'Seating, ergonomic office and living furniture.',
    max_triangles: 50000,
    max_dimension_m: 3.0,
    is_watertight_required: false,
    max_degenerate_faces: 0,
  },
  'Pieza Industrial': {
    id: 'industrial-part-01',
    name: 'Pieza Industrial',
    description: 'Precision mechanical components and manufactured engineering parts.',
    max_triangles: 100000,
    max_dimension_m: 1.2,
    is_watertight_required: true,
    max_degenerate_faces: 0,
  },
  'Prop / Decorativo': {
    id: 'prop-decor-01',
    name: 'Prop / Decorativo',
    description: 'General environment assets, architectural fittings and props.',
    max_triangles: 35000,
    max_dimension_m: 4.0,
    is_watertight_required: false,
    max_degenerate_faces: 0,
  },
};

export const SAMPLES: SampleAsset[] = [
  {
    id: 'sample-monitor',
    name: 'Flat Display Monitor',
    category: 'Monitor',
    expected_verdict: 'CONFORMANT',
    description: 'Thin aspect ratio (0.9 x 0.55 x 0.05 m), within 25,000 triangle budget.',
  },
  {
    id: 'sample-chair',
    name: 'Standard Office Chair',
    category: 'Mobiliario (Chair)',
    expected_verdict: 'CONFORMANT',
    description: 'Furniture bounds (0.6 x 0.6 x 0.78 m), within 50,000 triangle budget.',
  },
  {
    id: 'sample-industrial',
    name: 'Industrial Valve Spherical Part',
    category: 'Pieza Industrial',
    expected_verdict: 'CONFORMANT',
    description: 'Watertight manifold sphere (0.5m diameter), solid volume verified.',
  },
  {
    id: 'sample-oversized-chair',
    name: 'Oversized Colossus Chair (Violation Demo)',
    category: 'Mobiliario (Chair)',
    expected_verdict: 'NON_CONFORMANT',
    description: 'Exceeds scale bounds (5.0m > 3.0m limit). Demonstrates deterministic rejection.',
  },
];

async function calculateSha256(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

interface GltfAccessor {
  count?: number;
  min?: number[];
  max?: number[];
}

interface GltfPrimitive {
  attributes?: Record<string, number>;
  indices?: number;
}

interface GltfMesh {
  primitives?: GltfPrimitive[];
}

interface GltfRoot {
  accessors?: GltfAccessor[];
  meshes?: GltfMesh[];
}

function parseGlbFeatures(buffer: ArrayBuffer, mesh: MeshAnalysis): GeometricFeatures {
  const view = new DataView(buffer);
  let triangleCount = 0;
  let vertexCount = 0;
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  let hasBoundingBox = false;

  try {
    const magic = view.getUint32(0, true);
    if (magic === 0x46546c67) {
      // 'glTF' in little-endian
      const chunkLen = view.getUint32(12, true);
      const chunkType = view.getUint32(16, true);
      if (chunkType === 0x4e4f534a) {
        // 'JSON'
        const decoder = new TextDecoder('utf-8');
        const jsonText = decoder.decode(new Uint8Array(buffer, 20, chunkLen));
        const gltf = JSON.parse(jsonText) as GltfRoot;
        const accessors = gltf.accessors || [];
        const meshes = gltf.meshes || [];

        for (const mesh of meshes) {
          for (const prim of mesh.primitives || []) {
            const posIdx = prim.attributes?.POSITION;
            if (posIdx !== undefined && accessors[posIdx]) {
              const posAcc = accessors[posIdx];
              vertexCount += posAcc.count || 0;
              if (posAcc.min && posAcc.max) {
                minX = Math.min(minX, posAcc.min[0]);
                minY = Math.min(minY, posAcc.min[1]);
                minZ = Math.min(minZ, posAcc.min[2]);
                maxX = Math.max(maxX, posAcc.max[0]);
                maxY = Math.max(maxY, posAcc.max[1]);
                maxZ = Math.max(maxZ, posAcc.max[2]);
                hasBoundingBox = true;
              }
            }
            if (prim.indices !== undefined && accessors[prim.indices]) {
              triangleCount += Math.floor((accessors[prim.indices].count || 0) / 3);
            } else if (posIdx !== undefined && accessors[posIdx]) {
              triangleCount += Math.floor((accessors[posIdx].count || 0) / 3);
            }
          }
        }
      }
    }
  } catch (e) {
    console.warn('Fallback GLB parsing:', e);
  }

  const dx = hasBoundingBox ? Math.max(0, maxX - minX) : 1.0;
  const dy = hasBoundingBox ? Math.max(0, maxY - minY) : 1.0;
  const dz = hasBoundingBox ? Math.max(0, maxZ - minZ) : 1.0;
  const extents: [number, number, number] = [
    Math.round(dx * 10000) / 10000,
    Math.round(dy * 10000) / 10000,
    Math.round(dz * 10000) / 10000,
  ];
  const maxDim = Math.max(...extents);
  const volume = Math.round(dx * dy * dz * 1000000) / 1000000;

  // Watertightness and degenerate faces are read from the triangle data (same rules as the Python engine);
  // geometry that cannot be read counts as open, and the caller turns it into an INCOMPLETE verdict.
  return {
    triangle_count: triangleCount || 12,
    vertex_count: vertexCount || 8,
    is_watertight: mesh.watertight,
    extents,
    max_dimension_m: Math.round(maxDim * 10000) / 10000,
    volume_m3: volume,
    degenerate_faces_count: mesh.degenerateFaces,
  };
}

function inferAiProposal(features: GeometricFeatures, fileName: string): AiProposal {
  const normDims = [...features.extents].sort((a, b) => a - b);
  const maxD = Math.max(features.max_dimension_m, 0.001);
  const thicknessRatio = normDims[0] / maxD;

  if (fileName.toLowerCase().includes('monitor') || thicknessRatio < 0.15) {
    return {
      predicted_category: 'Monitor',
      confidence: 0.82,
      source: 'Deterministic AI (Geometry Heuristics)',
      reasoning: 'Heuristic classification: Thin depth profile characteristic of display monitors.',
    };
  }

  if (
    fileName.toLowerCase().includes('industrial') ||
    (features.is_watertight && features.triangle_count > 1000)
  ) {
    return {
      predicted_category: 'Pieza Industrial',
      confidence: 0.88,
      source: 'Deterministic AI (Geometry Heuristics)',
      reasoning:
        'Heuristic classification: High-density solid manifold characteristic of precision industrial parts.',
    };
  }

  return {
    predicted_category: 'Mobiliario (Chair)',
    confidence: 0.79,
    source: 'Deterministic AI (Geometry Heuristics)',
    reasoning: 'Heuristic classification: 3D bounding envelope matching furniture proportions.',
  };
}

function evaluateConformance(
  features: GeometricFeatures,
  profile: ProfileDefinition
): { checks: CheckResult[]; verdict: ConformanceVerdict; summary: string } {
  const checks: CheckResult[] = [];

  // 1. Triangle Count Budget
  const passTriangles = features.triangle_count <= profile.max_triangles;
  checks.push({
    name: 'budget_triangles',
    label: 'Triangle Budget (Polygon Density)',
    value: features.triangle_count,
    limit: profile.max_triangles,
    passed: passTriangles,
    severity: 'blocking',
    message: passTriangles
      ? `Within budget (${features.triangle_count.toLocaleString()} <= ${profile.max_triangles.toLocaleString()})`
      : `Exceeds polygon limit: ${features.triangle_count.toLocaleString()} > ${profile.max_triangles.toLocaleString()}`,
  });

  // 2. Metric Scale Dimension
  const passScale = features.max_dimension_m <= profile.max_dimension_m;
  checks.push({
    name: 'metric_scale',
    label: 'Physical Extents (Metric Scale Bounds)',
    value: `${features.max_dimension_m.toFixed(3)} m`,
    limit: `<= ${profile.max_dimension_m.toFixed(1)} m`,
    passed: passScale,
    severity: 'blocking',
    message: passScale
      ? `Scale conforms (${features.max_dimension_m.toFixed(3)} m <= ${profile.max_dimension_m.toFixed(1)} m)`
      : `Scale out of bounds: ${features.max_dimension_m.toFixed(3)} m > ${profile.max_dimension_m.toFixed(1)} m`,
  });

  // 3. Watertight Solid Integrity
  let passWatertight = true;
  let severity: CheckSeverity = 'advisory';
  let msg = 'Watertightness not mandated for this category';
  if (profile.is_watertight_required) {
    passWatertight = features.is_watertight;
    severity = 'blocking';
    msg = passWatertight
      ? 'Solid manifold verified'
      : 'Mesh is non-manifold or contains open boundary edges';
  }
  checks.push({
    name: 'integrity_watertight',
    label: 'Solid Integrity (Watertightness)',
    value: features.is_watertight ? 'Watertight Solid' : 'Open Surface',
    limit: profile.is_watertight_required ? 'Required' : 'Optional',
    passed: passWatertight,
    severity,
    message: msg,
  });

  // 4. Degenerate Faces Check
  const passDegenerate = features.degenerate_faces_count <= profile.max_degenerate_faces;
  checks.push({
    name: 'degenerate_faces',
    label: 'Geometry Quality (Degenerate Faces)',
    value: features.degenerate_faces_count,
    limit: profile.max_degenerate_faces,
    passed: passDegenerate,
    severity: 'blocking',
    message: passDegenerate
      ? 'Zero degenerate micro-faces detected'
      : `Detected ${features.degenerate_faces_count} degenerate faces with area <= 1e-12 m²`,
  });

  return { checks, ...aggregateVerdict(checks) };
}

/** Fail-closed aggregation: one failing blocking check rejects the asset. */
function aggregateVerdict(checks: CheckResult[]): { verdict: ConformanceVerdict; summary: string } {
  const hasBlockingFailure = checks.some((c) => !c.passed && c.severity === 'blocking');
  const hasAdvisoryFailure = checks.some((c) => !c.passed && c.severity === 'advisory');

  if (hasBlockingFailure) {
    return { verdict: 'NON_CONFORMANT', summary: 'Asset REJECTED: One or more blocking technical contract rules failed.' };
  }
  if (hasAdvisoryFailure) {
    return {
      verdict: 'CONFORMANT_WITH_FINDINGS',
      summary: 'Asset CONFORMANT WITH FINDINGS: All blocking criteria met; advisory warnings flagged.',
    };
  }
  return { verdict: 'CONFORMANT', summary: 'Asset CONFORMANT: All technical contract criteria fully satisfied.' };
}

const MIB = 1024 * 1024;

/** Optional checks, added only when the profile defines the limit (same rules as the Python engine). All blocking. */
function storeChecks(features: GeometricFeatures, profile: ProfileDefinition, sizeBytes: number): CheckResult[] {
  const out: CheckResult[] = [];
  const mb = (bytes: number) => (bytes / MIB).toFixed(2);

  if (profile.max_file_mb != null) {
    const passed = sizeBytes <= profile.max_file_mb * MIB;
    out.push({
      name: 'file_size',
      label: 'File Weight (MB)',
      value: `${mb(sizeBytes)} MB`,
      limit: `<= ${profile.max_file_mb} MB`,
      passed,
      severity: 'blocking',
      message: passed
        ? `File weight within limit (${mb(sizeBytes)} MB)`
        : `File too heavy: ${mb(sizeBytes)} MB > ${profile.max_file_mb} MB`,
    });
  }

  if (profile.max_texture_px != null) {
    const side = features.texture_max_side_px;
    const measurable = features.inventory_readable !== false && side !== null && side !== undefined;
    const passed = measurable && (side as number) <= profile.max_texture_px; // Fail-closed when unmeasurable.
    out.push({
      name: 'texture_resolution',
      label: 'Texture Resolution (px)',
      value: measurable ? `${side} px` : 'unknown',
      limit: `<= ${profile.max_texture_px} px`,
      passed,
      severity: 'blocking',
      message: passed
        ? `Largest texture ${side} px`
        : !measurable
        ? 'A texture could not be measured (external or unsupported image)'
        : `Texture too large: ${side} px > ${profile.max_texture_px} px`,
    });
  }

  if (profile.max_materials != null) {
    const count = features.material_count ?? 0;
    const passed = count <= profile.max_materials;
    out.push({
      name: 'material_budget',
      label: 'Material Budget',
      value: count,
      limit: profile.max_materials,
      passed,
      severity: 'blocking',
      message: passed ? `${count} materials in use` : `Too many materials: ${count} > ${profile.max_materials}`,
    });
  }

  if (profile.require_uv_and_textures) {
    const passed =
      features.inventory_readable !== false && !!features.has_uv_coordinates && (features.textured_material_count ?? 0) >= 1;
    out.push({
      name: 'uv_and_textures',
      label: 'UV Coordinates and Textures',
      value: passed ? 'present' : 'missing',
      limit: 'Required',
      passed,
      severity: 'blocking',
      message: passed
        ? 'UV coordinates and textured materials present'
        : 'Meshes without UV coordinates or no textured material: the model will look flat',
    });
  }
  return out;
}

export async function evaluateFileStandalone(
  file: File,
  overrideProfile?: string,
  customProfile?: ProfileDefinition
): Promise<EvaluationResult> {
  if (customProfile) {
    const invalid = validateProfile(customProfile);
    if (invalid.length > 0) throw new Error(`Invalid profile: ${invalid.join(', ')}`);
  }
  const startTime = performance.now();
  const buffer = await file.arrayBuffer();
  const sha256 = await calculateSha256(buffer);
  const mesh = analyzeGlbMesh(buffer);
  const inventory = readInventory(buffer);
  const features: GeometricFeatures = {
    ...parseGlbFeatures(buffer, mesh),
    texture_max_side_px: inventory.textureMaxSidePx,
    material_count: inventory.materialCount,
    textured_material_count: inventory.texturedMaterialCount,
    has_uv_coordinates: inventory.hasUvCoordinates,
    inventory_readable: inventory.readable,
  };
  const aiProposal = inferAiProposal(features, file.name);

  const profileKey =
    overrideProfile && overrideProfile in PROFILES
      ? overrideProfile
      : aiProposal.predicted_category in PROFILES
      ? aiProposal.predicted_category
      : 'Mobiliario (Chair)';

  const profile = customProfile ?? PROFILES[profileKey] ?? PROFILES['Mobiliario (Chair)'];
  const evaluated = evaluateConformance(features, profile);
  evaluated.checks.push(...storeChecks(features, profile, file.size));
  const aggregate = aggregateVerdict(evaluated.checks);
  evaluated.verdict = aggregate.verdict;
  evaluated.summary = aggregate.summary;
  const { checks } = evaluated;
  // Fail-closed: an asset whose geometry could not be read is never approved.
  const verdict: ConformanceVerdict = mesh.readable ? evaluated.verdict : 'INCOMPLETE';
  const summary = mesh.readable
    ? evaluated.summary
    : 'Asset INCOMPLETE: the geometry could not be read, so it is rejected by default.';
  const durationMs = performance.now() - startTime;

  return {
    asset_sha256: sha256,
    asset_name: file.name,
    asset_size_bytes: file.size,
    features,
    ai_proposal: aiProposal,
    applied_profile: profile,
    checks,
    verdict,
    verdict_summary: summary,
    evaluation_duration_ms: Math.round(durationMs * 100) / 100,
    timestamp_utc: new Date().toISOString(),
  };
}
