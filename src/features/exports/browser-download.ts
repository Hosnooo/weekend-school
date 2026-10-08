/**
 * Do not treat a failed API response (or an HTML login redirect) as a file.
 * Both endpoints require the caller's existing authenticated session.
 */
export type ProtectedDownloadIssue = 'expired' | 'access' | 'unavailable';

export class ProtectedDownloadFailure extends Error {
  constructor(public readonly reason: ProtectedDownloadIssue) {
    super(reason);
    this.name = 'ProtectedDownloadFailure';
  }
}

export function downloadStatusIssue(status: number): ProtectedDownloadIssue {
  if (status === 410) return 'expired';
  if ([401, 403, 404].includes(status)) return 'access';
  return 'unavailable';
}

export async function downloadProtectedFile(
  href: string,
  allowed: 'exports' | 'roster'
): Promise<void> {
  const allowedPath = allowed === 'exports'
    ? /^\/api\/exports\/[a-zA-Z0-9-]+$/
    : /^\/api\/roster\/export\?[^#]+$/;
  if (!allowedPath.test(href)) throw new ProtectedDownloadFailure('unavailable');

  const response = await fetch(href, {credentials: 'same-origin', cache: 'no-store'});
  if (!response.ok) throw new ProtectedDownloadFailure(downloadStatusIssue(response.status));

  const disposition = response.headers.get('Content-Disposition') ?? '';
  const contentType = response.headers.get('Content-Type') ?? '';
  // Login pages and JSON/text error bodies are never valid downloads.
  if (!/attachment/i.test(disposition) || /text\/html|application\/json/i.test(contentType)) {
    throw new ProtectedDownloadFailure('access');
  }

  const quotedName = /filename="([^"\r\n]+)"/i.exec(disposition)?.[1];
  const filename = quotedName?.replace(/[\\/]/g, '-') ?? 'weekend-school-export';
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.hidden = true;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    // Avoid revoking before the browser has taken ownership of the download.
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  }
}
