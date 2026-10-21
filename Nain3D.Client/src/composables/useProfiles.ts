import { computed, ref } from 'vue';
import {
  AUTO_PROFILE,
  MAX_PROFILES,
  duplicateProfile,
  loadActiveProfileId,
  loadProfiles,
  saveActiveProfileId,
  saveProfiles,
} from '../profiles/profileStore';
import { PROFILES } from '../services/mockEvaluator';
import type { ProfileDefinition } from '../types/contracts';

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** The user's store profiles and the active selection, remembered on this device only. */
export function useProfiles() {
  const store = storage();
  const custom = ref<ProfileDefinition[]>(store ? loadProfiles(store) : []);
  const builtIn = Object.values(PROFILES);
  const stored = store ? loadActiveProfileId(store) : AUTO_PROFILE;
  const known = (id: string) => id === AUTO_PROFILE || builtIn.some((p) => p.id === id) || custom.value.some((p) => p.id === id);
  const activeId = ref(known(stored) ? stored : AUTO_PROFILE);

  const persist = () => {
    if (store) saveProfiles(store, custom.value);
  };

  /** Built-in profile chosen by the user, by name (the evaluator's override), or null. */
  const activeBuiltInName = computed(() => builtIn.find((p) => p.id === activeId.value)?.name ?? null);
  /** User profile chosen, or null. */
  const activeCustom = computed(() => custom.value.find((p) => p.id === activeId.value) ?? null);
  const canAdd = computed(() => custom.value.length < MAX_PROFILES);

  function select(id: string): void {
    activeId.value = known(id) ? id : AUTO_PROFILE;
    if (store) saveActiveProfileId(store, activeId.value);
  }

  function save(profile: ProfileDefinition): void {
    const index = custom.value.findIndex((p) => p.id === profile.id);
    if (index >= 0) custom.value = custom.value.map((p) => (p.id === profile.id ? profile : p));
    else if (canAdd.value) custom.value = [...custom.value, profile];
    persist();
  }

  function remove(id: string): void {
    custom.value = custom.value.filter((p) => p.id !== id);
    if (activeId.value === id) select(AUTO_PROFILE);
    persist();
  }

  function duplicate(id: string): void {
    const source = custom.value.find((p) => p.id === id);
    if (source && canAdd.value) save(duplicateProfile(source));
  }

  return { custom, builtIn, activeId, activeBuiltInName, activeCustom, canAdd, select, save, remove, duplicate };
}
