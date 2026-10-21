import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SAMPLE_IDS } from '../samples/catalog';
import { TETRAHEDRON, buildGlb } from './glbFixture';
import { evaluateFileStandalone } from './mockEvaluator';

const sample = (id: string) =>
  new File([readFileSync(fileURLToPath(new URL(`../../public/samples/${id}.glb`, import.meta.url)))], `${id}.glb`);

// Values the Python engine reports for the same files (tests/test_hero_samples.py, probed 2026-10-19).
const PYTHON = {
  'sample-shoe': { verdict: 'CONFORMANT', triangles: 22700, watertight: false, degenerate: 0 },
  'sample-oversized-shoe': { verdict: 'NON_CONFORMANT', triangles: 22700, watertight: false, degenerate: 0 },
  'sample-industrial': { verdict: 'CONFORMANT', triangles: 6848, watertight: true, degenerate: 0 },
  'sample-chair': { verdict: 'CONFORMANT', triangles: 728, watertight: true, degenerate: 0 },
  'sample-oversized-chair': { verdict: 'NON_CONFORMANT', triangles: 728, watertight: true, degenerate: 0 },
} as const;

describe('in-browser evaluator agrees with the Python engine on the bundled samples', () => {
  for (const [id, expected] of Object.entries(PYTHON)) {
    it(id, async () => {
      const r = await evaluateFileStandalone(sample(id));
      expect(r.verdict).toBe(expected.verdict);
      expect(r.features.triangle_count).toBe(expected.triangles);
      expect(r.features.is_watertight).toBe(expected.watertight);
      expect(r.features.degenerate_faces_count).toBe(expected.degenerate);
    });
  }

  it('covers every sample with a known Python result, except the screen-textured monitor', () => {
    const covered = Object.keys(PYTHON);
    expect(SAMPLE_IDS.filter((id) => !covered.includes(id))).toEqual(['sample-monitor']);
  });

  it('does not propose an industrial part for an open mesh just because it is large', async () => {
    const r = await evaluateFileStandalone(sample('sample-shoe'));
    expect(r.ai_proposal.predicted_category).not.toBe('Pieza Industrial');
  });
});

describe('store checks (same rules as the Python engine)', () => {
  const base = {
    id: 'store-1',
    name: 'My store',
    description: 'Custom',
    max_triangles: 50000,
    max_dimension_m: 3,
    is_watertight_required: false,
    max_degenerate_faces: 0,
  };
  const failed = (r: { checks: { name: string; passed: boolean }[] }) => r.checks.filter((c) => !c.passed).map((c) => c.name);

  it('built-in profiles run exactly the four original checks', async () => {
    const r = await evaluateFileStandalone(sample('sample-shoe'), 'Mobiliario (Chair)');
    expect(r.checks).toHaveLength(4);
  });

  it('adds the checks the profile asks for, after the original four', async () => {
    const profile = { ...base, max_file_mb: 5, max_texture_px: 2048, max_materials: 4, require_uv_and_textures: true };
    const r = await evaluateFileStandalone(sample('sample-shoe'), undefined, profile);
    expect(r.checks.map((c) => c.name).slice(4)).toEqual(['file_size', 'texture_resolution', 'material_budget', 'uv_and_textures']);
    expect(r.verdict).toBe('CONFORMANT');
    expect(r.applied_profile.id).toBe('store-1');
  });

  it('rejects a heavy file, a large texture, too many materials and a model without textures', async () => {
    expect(failed(await evaluateFileStandalone(sample('sample-shoe'), undefined, { ...base, max_file_mb: 0.5 }))).toEqual(['file_size']);
    expect(failed(await evaluateFileStandalone(sample('sample-shoe'), undefined, { ...base, max_texture_px: 512 }))).toEqual(['texture_resolution']);
    expect(failed(await evaluateFileStandalone(sample('sample-monitor'), undefined, { ...base, max_materials: 2 }))).toEqual(['material_budget']);
    expect(failed(await evaluateFileStandalone(sample('sample-chair'), undefined, { ...base, require_uv_and_textures: true }))).toEqual(['uv_and_textures']);
  });

  it('passes a resolution limit when the model has no textures at all', async () => {
    const plain = buildGlb({ ...TETRAHEDRON });
    const r = await evaluateFileStandalone(new File([plain], 'a.glb'), undefined, { ...base, max_texture_px: 256 });
    expect(r.checks.find((c) => c.name === 'texture_resolution')?.passed).toBe(true);
  });

  it('refuses an invalid custom profile instead of evaluating against it', async () => {
    await expect(evaluateFileStandalone(sample('sample-chair'), undefined, { ...base, max_file_mb: -3 })).rejects.toThrow(/Invalid profile/);
  });
});

describe('fail-closed behaviour', () => {
  it('rejects an industrial part that is an open surface', async () => {
    const open = buildGlb({ positions: TETRAHEDRON.positions, indices: TETRAHEDRON.indices.slice(0, 9) });
    const r = await evaluateFileStandalone(new File([open], 'industrial-open.glb'));
    expect(r.applied_profile.name).toBe('Pieza Industrial');
    expect(r.verdict).toBe('NON_CONFORMANT');
    expect(r.checks.find((c) => c.name === 'integrity_watertight')?.passed).toBe(false);
  });

  it('reports INCOMPLETE when the geometry cannot be read', async () => {
    const draco = buildGlb({ ...TETRAHEDRON, extensionsRequired: ['KHR_draco_mesh_compression'] });
    const r = await evaluateFileStandalone(new File([draco], 'compressed.glb'));
    expect(r.verdict).toBe('INCOMPLETE');
  });
});
