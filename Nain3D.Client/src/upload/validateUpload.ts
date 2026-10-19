export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export type UploadProblem = 'empty' | 'notGlb' | 'tooLarge';

/** Pure check run before a visitor's file is read: binary glTF only, non-empty, at most 25 MB. */
export function validateUpload(file: { name: string; size: number }): UploadProblem | null {
  if (!/\.glb$/i.test(file.name)) return 'notGlb';
  if (file.size <= 0) return 'empty';
  if (file.size > MAX_UPLOAD_BYTES) return 'tooLarge';
  return null;
}
