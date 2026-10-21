export type ShareResult = 'shared' | 'downloaded' | 'cancelled';

/** The browser capabilities used, injected so the logic can be tested. */
export interface ShareEnv {
  canShare?: (data: { files: File[] }) => boolean;
  share?: (data: { files: File[]; title: string }) => Promise<void>;
  createUrl: (blob: Blob) => string;
  revokeUrl: (url: string) => void;
  click: (href: string, fileName: string) => void;
}

export function browserShareEnv(): ShareEnv {
  const nav = typeof navigator === 'undefined' ? undefined : navigator;
  return {
    canShare: nav?.canShare ? (data) => nav.canShare(data) : undefined,
    share: nav?.share ? (data) => nav.share(data) : undefined,
    createUrl: (blob) => URL.createObjectURL(blob),
    revokeUrl: (url) => URL.revokeObjectURL(url),
    click: (href, fileName) => {
      const link = document.createElement('a');
      link.href = href;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
    },
  };
}

function download(bytes: Uint8Array, fileName: string, env: ShareEnv): void {
  const url = env.createUrl(new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' }));
  env.click(url, fileName);
  env.revokeUrl(url);
}

/** Opens the system share sheet with the PDF; downloads it where the browser cannot share files. */
export async function shareOrDownload(
  bytes: Uint8Array,
  fileName: string,
  title: string,
  env: ShareEnv = browserShareEnv(),
): Promise<ShareResult> {
  const file = new File([bytes.buffer as ArrayBuffer], fileName, { type: 'application/pdf' });
  if (env.share && env.canShare?.({ files: [file] })) {
    try {
      await env.share({ files: [file], title });
      return 'shared';
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return 'cancelled';
      // Any other failure (permission, unsupported target): fall back to a plain download.
    }
  }
  download(bytes, fileName, env);
  return 'downloaded';
}
