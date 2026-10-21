import { describe, expect, it, vi } from 'vitest';
import { shareOrDownload, type ShareEnv } from './share';

const bytes = Uint8Array.from([0x25, 0x50, 0x44, 0x46]);

function env(overrides: Partial<ShareEnv> = {}): ShareEnv & { clicked: string[]; revoked: string[] } {
  const clicked: string[] = [];
  const revoked: string[] = [];
  return {
    canShare: undefined,
    share: undefined,
    createUrl: () => 'blob:fake',
    revokeUrl: (url) => revoked.push(url),
    click: (href, name) => clicked.push(`${href}|${name}`),
    clicked,
    revoked,
    ...overrides,
  };
}

describe('shareOrDownload', () => {
  it('opens the share sheet with the PDF file when the browser can share files', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const e = env({ canShare: () => true, share });
    expect(await shareOrDownload(bytes, 'informe.pdf', 'Informe', e)).toBe('shared');
    const arg = share.mock.calls[0][0] as { files: File[]; title: string };
    expect(arg.title).toBe('Informe');
    expect(arg.files[0].name).toBe('informe.pdf');
    expect(arg.files[0].type).toBe('application/pdf');
    expect(e.clicked).toEqual([]);
  });

  it('downloads when sharing files is not supported', async () => {
    const e = env({ canShare: () => false, share: vi.fn() });
    expect(await shareOrDownload(bytes, 'informe.pdf', 'Informe', e)).toBe('downloaded');
    expect(e.clicked).toEqual(['blob:fake|informe.pdf']);
    expect(e.revoked).toEqual(['blob:fake']);
  });

  it('downloads when there is no share API at all', async () => {
    const e = env();
    expect(await shareOrDownload(bytes, 'informe.pdf', 'Informe', e)).toBe('downloaded');
  });

  it('treats closing the share sheet as a cancellation, not an error', async () => {
    const abort = Object.assign(new Error('closed'), { name: 'AbortError' });
    const e = env({ canShare: () => true, share: vi.fn().mockRejectedValue(abort) });
    expect(await shareOrDownload(bytes, 'informe.pdf', 'Informe', e)).toBe('cancelled');
    expect(e.clicked).toEqual([]);
  });

  it('falls back to a download when sharing fails for another reason', async () => {
    const e = env({ canShare: () => true, share: vi.fn().mockRejectedValue(new Error('denied')) });
    expect(await shareOrDownload(bytes, 'informe.pdf', 'Informe', e)).toBe('downloaded');
    expect(e.clicked).toHaveLength(1);
  });
});
