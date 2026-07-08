import type { FullClient, PackFileCategory } from '../lib/client-store';

interface Props {
  client: FullClient;
  title: string;
  categories: PackFileCategory[];
}

export function SourceEvidenceStrip({ client, title, categories }: Props) {
  const rows = (client.packImports || [])
    .flatMap(pack => pack.manifestRows)
    .filter(row => categories.includes(row.category));
  const allVaultDocs = client.vaultDocs || [];
  const vaultDocs = allVaultDocs.filter(doc => doc.category && categories.includes(doc.category));
  const seen = rows.length || vaultDocs.length;
  const needsReview = rows.filter(row => row.reviewRequired).length + vaultDocs.filter(doc => doc.reviewRequired).length;
  const parsed = rows.filter(row => row.parseStatus === 'PARSED').length;

  return (
    <div className="mx-4 mb-4 hc-clay-raised rounded-2xl border border-hc-border/20 px-5 py-4 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto] gap-4">
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-black text-hc-text uppercase tracking-[0.25em]">{title} source evidence</div>
        <p className="text-[11px] text-hc-muted font-semibold mt-1">
          {seen
            ? `${seen} source file${seen === 1 ? '' : 's'} visible. ${parsed} parsed. ${needsReview} need review before live use.`
            : `No ${title.toLowerCase()} source file is attached yet. Treat this builder as missing-evidence until a pack or document is imported.`}
        </p>
      </div>
      <div className="flex flex-wrap gap-2 lg:justify-end">
        <span className={`pill ${seen ? 'pill-blue' : 'pill-amber'} text-[8px] font-black uppercase tracking-widest`}>
          {seen ? `${seen} sources` : 'Source missing'}
        </span>
        <span className={`pill ${needsReview ? 'pill-red' : seen ? 'pill-green' : 'pill-amber'} text-[8px] font-black uppercase tracking-widest`}>
          {needsReview ? `${needsReview} review` : seen ? 'Evidence ready' : 'Review required'}
        </span>
      </div>
      {rows.length > 0 && (
        <div className="lg:col-span-2 flex flex-wrap gap-2 min-w-0">
          {rows.slice(0, 3).map(row => (
            <span
              key={row.fileId}
              className="max-w-full rounded-lg bg-hc-border/10 px-2 py-1 text-[9px] font-black text-hc-muted uppercase tracking-wider leading-snug break-words whitespace-normal"
              title={row.originalFileName}
            >
              {row.originalFileName}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
