import type { Attachment } from '@/lib/types';

export default function AttachmentList({ items }: { items?: Attachment[] }) {
  if (!items || items.length === 0) return null;
  const images = items.filter((a) => a.kind === 'image');
  const voices = items.filter((a) => a.kind === 'voice');
  const files = items.filter((a) => a.kind === 'file');
  return (
    <div className="mt-2 space-y-2">
      {voices.map((a) => (
        <audio key={a.id} src={a.url ?? undefined} controls preload="none" className="w-full max-w-sm" />
      ))}
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((a) => (
            <a key={a.id} href={a.url ?? '#'} target="_blank" rel="noreferrer">
              <img src={a.url ?? ''} alt={a.file_name ?? 'image'} className="h-20 w-20 rounded-lg border object-cover" />
            </a>
          ))}
        </div>
      )}
      {files.map((a) => (
        <a
          key={a.id}
          href={a.url ?? '#'}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-medium text-slate-700 underline-offset-2 hover:underline"
        >
          <span className="rounded bg-slate-200 px-1.5 text-xs font-bold">FILE</span>
          <span className="truncate">{a.file_name}</span>
        </a>
      ))}
    </div>
  );
}

export function LinkChips({ links }: { links?: string[] }) {
  if (!links || links.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {links.map((l) => {
        let label = l;
        try {
          label = new URL(l).hostname.replace(/^www\./, '');
        } catch {}
        return (
          <a key={l} href={l} target="_blank" rel="noreferrer" className="rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-800">
            {label}
          </a>
        );
      })}
    </div>
  );
}
