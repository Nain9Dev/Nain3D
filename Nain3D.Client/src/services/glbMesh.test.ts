import { describe, expect, it } from 'vitest';
import { analyzeGlbMesh } from './glbMesh';
import { TETRAHEDRON, buildGlb } from './glbFixture';

describe('analyzeGlbMesh', () => {
  it('recognises a closed solid', () => {
    const r = analyzeGlbMesh(buildGlb(TETRAHEDRON));
    expect(r).toMatchObject({ readable: true, triangles: 4, watertight: true, degenerateFaces: 0 });
  });

  it('flags an open surface when one face is missing', () => {
    const open = { positions: TETRAHEDRON.positions, indices: TETRAHEDRON.indices.slice(0, 9) };
    expect(analyzeGlbMesh(buildGlb(open))).toMatchObject({ readable: true, watertight: false });
  });

  it('counts degenerate faces (area at or below 1e-12 m2)', () => {
    const collapsed = { positions: [...TETRAHEDRON.positions, 0.5, 0, 0], indices: [...TETRAHEDRON.indices, 0, 1, 4] };
    expect(analyzeGlbMesh(buildGlb(collapsed))).toMatchObject({ readable: true, degenerateFaces: 1 });
  });

  it('treats a non-indexed triangle soup as an open surface', () => {
    const soup = { positions: [0, 0, 0, 1, 0, 0, 0, 1, 0] };
    expect(analyzeGlbMesh(buildGlb(soup))).toMatchObject({ readable: true, triangles: 1, watertight: false });
  });

  it('fails closed on compressed geometry it cannot read', () => {
    const draco = buildGlb({ ...TETRAHEDRON, extensionsRequired: ['KHR_draco_mesh_compression'] });
    expect(analyzeGlbMesh(draco)).toMatchObject({ readable: false, watertight: false });
  });

  it('fails closed on primitive modes other than triangle lists', () => {
    expect(analyzeGlbMesh(buildGlb({ ...TETRAHEDRON, mode: 5 }))).toMatchObject({ readable: false });
  });

  it('fails closed on bytes that are not a GLB', () => {
    expect(analyzeGlbMesh(new ArrayBuffer(8))).toMatchObject({ readable: false });
  });
});
