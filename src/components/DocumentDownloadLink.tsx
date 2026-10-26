import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { documentDownloadUrl } from '../lib/document-download';

export function DocumentDownloadLink({ url, className, children }: { url: string; className?: string; children: ReactNode }) {
  const [resolved, setResolved] = useState<{ source: string; href?: string; failed?: boolean }>();
  useEffect(() => {
    let active = true;
    documentDownloadUrl(url).then(
      href => { if (active) setResolved({ source: url, href }); },
      () => { if (active) setResolved({ source: url, failed: true }); },
    );
    return () => { active = false; };
  }, [url]);
  const current = resolved?.source === url ? resolved : undefined;
  const label = current?.failed ? 'Document link unavailable' : 'Open document';
  return <a href={current?.href} target="_blank" rel="noopener noreferrer" className={className} aria-label={label} title={label} aria-disabled={!current?.href} onClick={event => { if (!current?.href) event.preventDefault(); }}>{children}</a>;
}
