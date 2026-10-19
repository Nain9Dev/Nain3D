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
