import { describe, expect, it } from 'vitest';
import type { ProfileDefinition } from '../types/contracts';
import {
  ACTIVE_KEY,
  MAX_PROFILES,
  PROFILES_KEY,
  defaultProfile,
  duplicateProfile,
  formFromProfile,
  loadActiveProfileId,
  loadProfiles,
  profileFromForm,
  saveActiveProfileId,
  saveProfiles,
} from './profileStore';

class MemoryStorage {
  data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
}

describe('persistence', () => {
  it('round-trips profiles', () => {
    const storage = new MemoryStorage();
    const list = [defaultProfile('Store A'), { ...defaultProfile('Store B'), max_file_mb: null }];
    saveProfiles(storage, list);
    expect(loadProfiles(storage)).toEqual(list);
  });

  it('survives corrupt, wrong-shaped or blocked storage', () => {
    const storage = new MemoryStorage();
    storage.setItem(PROFILES_KEY, '{not json');
    expect(loadProfiles(storage)).toEqual([]);
    storage.setItem(PROFILES_KEY, '{"a":1}');
    expect(loadProfiles(storage)).toEqual([]);
    const blocked = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    };
    expect(loadProfiles(blocked)).toEqual([]);
    expect(() => saveProfiles(blocked, [defaultProfile('x')])).not.toThrow();
  });

  it('drops stored profiles that no longer pass validation and keeps the rest', () => {
    const storage = new MemoryStorage();
    const good = defaultProfile('Good');
    storage.setItem(PROFILES_KEY, JSON.stringify([good, { ...good, id: 'bad', max_file_mb: -5 }, 42, null]));
    expect(loadProfiles(storage)).toEqual([good]);
  });

  it('keeps at most 20 profiles', () => {
    const storage = new MemoryStorage();
    const many = Array.from({ length: MAX_PROFILES + 5 }, (_, i) => defaultProfile(`P${i}`));
    saveProfiles(storage, many);
    expect(loadProfiles(storage)).toHaveLength(MAX_PROFILES);
  });

  it('remembers the active profile id', () => {
    const storage = new MemoryStorage();
    expect(loadActiveProfileId(storage)).toBe('auto');
    saveActiveProfileId(storage, 'custom-1');
    expect(storage.getItem(ACTIVE_KEY)).toBe('custom-1');
    expect(loadActiveProfileId(storage)).toBe('custom-1');
  });
});

describe('profiles', () => {
  it('creates valid, uniquely identified profiles with sensible store defaults', () => {
    const a = defaultProfile('A');
    const b = defaultProfile('B');
    expect(a.id).not.toBe(b.id);
    expect(a.id).toMatch(/^custom-/);
    expect(a).toMatchObject({ max_file_mb: 10, max_texture_px: 2048, max_materials: 8, require_uv_and_textures: true });
  });

  it('duplicates with a new id and a marked name', () => {
    const original = defaultProfile('Shop');
    const copy = duplicateProfile(original);
    expect(copy.id).not.toBe(original.id);
    expect(copy.name).toBe('Shop (2)');
    expect({ ...copy, id: '', name: '' }).toEqual({ ...original, id: '', name: '' });
  });
});

describe('form conversion', () => {
  const profile: ProfileDefinition = { ...defaultProfile('Shop'), max_file_mb: 7.5, max_texture_px: null };

  it('turns a profile into form strings and back', () => {
    const form = formFromProfile(profile);
    expect(form.max_file_mb).toBe('7.5');
    expect(form.max_texture_px).toBe('');
    const back = profileFromForm(form, profile.id);
    expect(back.errors).toEqual([]);
    expect(back.profile).toEqual(profile);
  });

  it('treats an empty optional field as "not checked"', () => {
    const form = { ...formFromProfile(profile), max_file_mb: '', max_materials: '  ' };
    const { profile: result } = profileFromForm(form, 'x');
    expect(result?.max_file_mb).toBeNull();
    expect(result?.max_materials).toBeNull();
  });

  it('accepts decimal commas typed on a Spanish keyboard', () => {
    const { profile: result } = profileFromForm({ ...formFromProfile(profile), max_dimension_m: '2,5' }, 'x');
    expect(result?.max_dimension_m).toBe(2.5);
  });

  it('reports every invalid field and returns no profile', () => {
    const form = { ...formFromProfile(profile), name: '', max_triangles: 'abc', max_file_mb: '-1', max_texture_px: '4' };
    const result = profileFromForm(form, 'x');
    expect(result.profile).toBeUndefined();
    expect(result.errors.sort()).toEqual(['max_file_mb', 'max_texture_px', 'max_triangles', 'name']);
  });

  it('rejects numbers that are only partly numeric', () => {
    expect(profileFromForm({ ...formFromProfile(profile), max_triangles: '100abc' }, 'x').errors).toContain('max_triangles');
  });
});
