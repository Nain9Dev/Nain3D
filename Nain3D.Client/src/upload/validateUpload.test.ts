import { describe, expect, it } from 'vitest';
import { shouldUseBackend } from '../services/backend';
import { MAX_UPLOAD_BYTES, validateUpload } from './validateUpload';

describe('validateUpload', () => {
  it('accepts a binary glTF within the size limit', () => {
    expect(validateUpload({ name: 'model.glb', size: 1024 })).toBeNull();
    expect(validateUpload({ name: 'MODEL.GLB', size: MAX_UPLOAD_BYTES })).toBeNull();
  });

  it('rejects anything that is not a .glb', () => {
    expect(validateUpload({ name: 'model.gltf', size: 1024 })).toBe('notGlb');
    expect(validateUpload({ name: 'model.obj', size: 1024 })).toBe('notGlb');
    expect(validateUpload({ name: 'glb', size: 1024 })).toBe('notGlb');
  });

  it('rejects empty and oversized files', () => {
    expect(validateUpload({ name: 'a.glb', size: 0 })).toBe('empty');
    expect(validateUpload({ name: 'a.glb', size: MAX_UPLOAD_BYTES + 1 })).toBe('tooLarge');
  });

  it('keeps the limit at 25 MB', () => {
    expect(MAX_UPLOAD_BYTES).toBe(25 * 1024 * 1024);
  });
});

describe('shouldUseBackend', () => {
  it('only talks to the API from a local development host', () => {
    for (const host of ['localhost', '127.0.0.1', '[::1]']) expect(shouldUseBackend(host)).toBe(true);
  });

  it('keeps files in the browser on the public site and on any other host', () => {
    for (const host of ['3d.naindev.com', 'www.naindev.com', 'example.com']) expect(shouldUseBackend(host)).toBe(false);
  });
});
