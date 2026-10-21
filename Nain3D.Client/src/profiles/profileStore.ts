import type { ProfileDefinition } from '../types/contracts';
import { validateProfile } from './validateProfile';

export const PROFILES_KEY = 'nain3d.profiles.v1';
export const ACTIVE_KEY = 'nain3d.activeProfile';
export const MAX_PROFILES = 20;
/** Value of the active-profile selector meaning "let the AI propose one of the built-in profiles". */
export const AUTO_PROFILE = 'auto';

type Reader = Pick<Storage, 'getItem'>;
type Writer = Pick<Storage, 'setItem'>;

/** Reads the user's profiles. Corrupt data, a blocked storage or an invalid entry never throws: it is skipped. */
export function loadProfiles(storage: Reader): ProfileDefinition[] {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(PROFILES_KEY) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((p): p is ProfileDefinition => typeof p === 'object' && p !== null && validateProfile(p as ProfileDefinition).length === 0)
      .slice(0, MAX_PROFILES);
  } catch {
    return [];
  }
}

export function saveProfiles(storage: Writer, profiles: ProfileDefinition[]): void {
  try {
    storage.setItem(PROFILES_KEY, JSON.stringify(profiles.slice(0, MAX_PROFILES)));
  } catch {
    // Storage can be full or blocked (private mode); the profiles then live only for this session.
  }
}

export function loadActiveProfileId(storage: Reader): string {
  try {
    return storage.getItem(ACTIVE_KEY) ?? AUTO_PROFILE;
  } catch {
    return AUTO_PROFILE;
  }
}

export function saveActiveProfileId(storage: Writer, id: string): void {
  try {
    storage.setItem(ACTIVE_KEY, id);
  } catch {
    // Not remembering the selection is acceptable.
  }
}

function newProfileId(): string {
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Math.random()).slice(2);
  return `custom-${random.slice(0, 8)}`;
}

/** A sensible starting point for a web or AR store; the user edits it. */
export function defaultProfile(name: string): ProfileDefinition {
  return {
    id: newProfileId(),
    name,
    description: '',
    max_triangles: 100_000,
    max_dimension_m: 2,
    is_watertight_required: false,
    max_degenerate_faces: 0,
    max_file_mb: 10,
    max_texture_px: 2048,
    max_materials: 8,
    require_uv_and_textures: true,
  };
}

export function duplicateProfile(profile: ProfileDefinition): ProfileDefinition {
  return { ...profile, id: newProfileId(), name: `${profile.name} (2)`.slice(0, 80) };
}

export type ProfileForm = Record<
  'name' | 'description' | 'max_triangles' | 'max_dimension_m' | 'max_degenerate_faces' | 'max_file_mb' | 'max_texture_px' | 'max_materials',
  string
> & { is_watertight_required: boolean; require_uv_and_textures: boolean };

const show = (value: number | null | undefined) => (value === null || value === undefined ? '' : String(value));

export function formFromProfile(p: ProfileDefinition): ProfileForm {
  return {
    name: p.name,
    description: p.description,
    max_triangles: show(p.max_triangles),
    max_dimension_m: show(p.max_dimension_m),
    max_degenerate_faces: show(p.max_degenerate_faces),
    max_file_mb: show(p.max_file_mb),
    max_texture_px: show(p.max_texture_px),
    max_materials: show(p.max_materials),
    is_watertight_required: p.is_watertight_required,
    require_uv_and_textures: !!p.require_uv_and_textures,
  };
}

/** Parses a typed number: accepts a decimal comma, rejects anything that is not entirely numeric. */
function parse(text: string): number | null {
  const clean = text.trim().replace(',', '.');
  if (clean === '') return null;
  return /^-?\d+(\.\d+)?$/.test(clean) ? Number(clean) : Number.NaN;
}

export function profileFromForm(form: ProfileForm, id: string): { profile?: ProfileDefinition; errors: string[] } {
  const required = (value: string) => parse(value) ?? Number.NaN;
  const candidate: ProfileDefinition = {
    id,
    name: form.name.trim(),
    description: form.description.trim(),
    max_triangles: required(form.max_triangles),
    max_dimension_m: required(form.max_dimension_m),
    is_watertight_required: form.is_watertight_required,
    max_degenerate_faces: parse(form.max_degenerate_faces) ?? 0,
    max_file_mb: parse(form.max_file_mb),
    max_texture_px: parse(form.max_texture_px),
    max_materials: parse(form.max_materials),
    require_uv_and_textures: form.require_uv_and_textures,
  };
  const errors = validateProfile(candidate);
  return errors.length > 0 ? { errors } : { profile: candidate, errors: [] };
}
