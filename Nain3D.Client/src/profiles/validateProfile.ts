import type { ProfileDefinition } from '../types/contracts';

/**
 * Field names that break the contract. The bounds mirror `ProfileDefinition` in the Python domain model,
 * so a profile accepted here is accepted by the API and the other way round.
 */
export function validateProfile(profile: ProfileDefinition): string[] {
  const bad: string[] = [];
  const inRange = (value: unknown, min: number, max: number, integer = false) =>
    typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max && (!integer || Number.isInteger(value));
  const text = (value: unknown, min: number, max: number) => typeof value === 'string' && value.length >= min && value.length <= max;

  if (!text(profile.id, 1, 64)) bad.push('id');
  if (!text(profile.name, 1, 80)) bad.push('name');
  if (!text(profile.description, 0, 300)) bad.push('description');
  if (!inRange(profile.max_triangles, 1, 100_000_000, true)) bad.push('max_triangles');
  if (!(inRange(profile.max_dimension_m, 0, 100_000) && profile.max_dimension_m > 0)) bad.push('max_dimension_m');
  if (!inRange(profile.max_degenerate_faces ?? 0, 0, Number.MAX_SAFE_INTEGER, true)) bad.push('max_degenerate_faces');
  if (profile.max_file_mb != null && !(inRange(profile.max_file_mb, 0, 1024) && profile.max_file_mb > 0)) bad.push('max_file_mb');
  if (profile.max_texture_px != null && !inRange(profile.max_texture_px, 16, 65_536, true)) bad.push('max_texture_px');
  if (profile.max_materials != null && !inRange(profile.max_materials, 0, 10_000, true)) bad.push('max_materials');
  return bad;
}
