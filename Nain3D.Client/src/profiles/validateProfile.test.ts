import { describe, expect, it } from 'vitest';
import type { ProfileDefinition } from '../types/contracts';
import { validateProfile } from './validateProfile';

const base: ProfileDefinition = {
  id: 'store-1',
  name: 'My store',
  description: 'Custom',
  max_triangles: 50000,
  max_dimension_m: 3,
  is_watertight_required: false,
  max_degenerate_faces: 0,
};

describe('validateProfile (same bounds as the Python ProfileDefinition)', () => {
  it('accepts a complete profile and one with every store limit', () => {
    expect(validateProfile(base)).toEqual([]);
    expect(validateProfile({ ...base, max_file_mb: 5, max_texture_px: 2048, max_materials: 4, require_uv_and_textures: true })).toEqual([]);
  });

  it.each([
    [{ max_triangles: 0 }, 'max_triangles'],
    [{ max_triangles: 100_000_001 }, 'max_triangles'],
    [{ max_dimension_m: 0 }, 'max_dimension_m'],
    [{ max_dimension_m: 100_001 }, 'max_dimension_m'],
    [{ max_degenerate_faces: -1 }, 'max_degenerate_faces'],
    [{ max_file_mb: 0 }, 'max_file_mb'],
    [{ max_file_mb: 1025 }, 'max_file_mb'],
    [{ max_texture_px: 4 }, 'max_texture_px'],
    [{ max_texture_px: 70_000 }, 'max_texture_px'],
    [{ max_materials: -1 }, 'max_materials'],
    [{ name: '' }, 'name'],
    [{ name: 'x'.repeat(81) }, 'name'],
    [{ id: '' }, 'id'],
  ])('rejects %j', (override, field) => {
    expect(validateProfile({ ...base, ...override } as ProfileDefinition)).toContain(field);
  });

  it('rejects non-numeric limits', () => {
    expect(validateProfile({ ...base, max_triangles: Number.NaN })).toContain('max_triangles');
    expect(validateProfile({ ...base, max_materials: 1.5 })).toContain('max_materials');
  });
});
