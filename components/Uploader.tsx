'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { BUCKET } from '@/lib/constants';
import type { NewAttachment } from '@/app/actions';

type Item = NewAttachment & { localUrl?: string; uploading?: boolean; error?: string; key: string };

function kindFor(mime: string): NewAttachment['kind'] {
  if (mime.startsWith('audio/')) return 'voice';
  if (mime.startsWith('image/')) return 'image';
  return 'file';
}

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-80);
}

/**
 * Attachments picker: voice recording, audio upload, photos/screenshots (including paste) and files.
 * Files upload to private storage right away; onChange receives the uploaded list.
 */
export default function Uploader({
  folder,
  onChange,
  compact = false,
  allowFiles = true,
  resetKey = 0,
}: {
  folder: string;
  onChange: (atts: NewAttachment[]) => void;
  compact?: boolean;
  allowFiles?: boolean;
  resetKey?: number;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const imgRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setItems([]);
  }, [resetKey]);

  useEffect(() => {
    onChange(items.filter((i) => !i.uploading && !i.error).map(({ path, file_name, mime, kind }) => ({ path, file_name, mime, kind })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  async function upload(file: File) {
    const key = crypto.randomUUID();
    const mime = file.type || 'application/octet-stream';
    const path = `${folder}/${new Date().toISOString().slice(0, 10)}/${key}-${safeName(file.name || 'file')}`;
    const item: Item = { key, path, file_name: file.name || 'file', mime, kind: kindFor(mime), uploading: true, localUrl: URL.createObjectURL(file) };
    setItems((prev) => [...prev, item]);
    const { error } = await createClient().storage.from(BUCKET).upload(path, file, { contentType: mime, upsert: false });
    setItems((prev) => prev.map((p) => (p.key === key ? { ...p, uploading: false, error: error?.message } : p)));
  }

  function onFiles(list: FileList | null) {
    if (!list) return;
    Array.from(list).forEach(upload);
  }

  // Paste screenshots anywhere on the page while this picker is mounted
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const files = Array.from(e.clipboardData?.files ?? []);
      if (files.length) {
        e.preventDefault();
        files.forEach((f) => upload(new File([f], f.name || `pasted-${Date.now()}.png`, { type: f.type })));
      }
    }
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folder]);

  const btn = 'flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 active:bg-slate-100';

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <VoiceRecorder onRecorded={upload} className={btn} />
        <button type="button" className={btn} onClick={() => imgRef.current?.click()}>
          Photo
        </button>
        {allowFiles && (
          <button type="button" className={btn} onClick={() => fileRef.current?.click()}>
            File
          </button>
        )}
        {!compact && (
          <button type="button" className={btn} onClick={() => audioRef.current?.click()}>
            Audio file
          </button>
        )}
        <input ref={imgRef} type="file" accept="image/*" multiple hidden onChange={(e) => { onFiles(e.target.files); e.target.value = ''; }} />
        <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.ppt,.pptx,application/pdf" multiple hidden onChange={(e) => { onFiles(e.target.files); e.target.value = ''; }} />
        <input ref={audioRef} type="file" accept="audio/*" hidden onChange={(e) => { onFiles(e.target.files); e.target.value = ''; }} />
      </div>
      {!compact && <p className="text-xs text-slate-500">Tip: you can paste a screenshot straight into this form.</p>}
      {items.length > 0 && (
        <ul className="space-y-2">
          {items.map((i) => (
            <li key={i.key} className="flex items-center gap-2 rounded-lg bg-slate-50 p-2 text-sm">
              {i.kind === 'image' && i.localUrl && <img src={i.localUrl} alt="" className="h-12 w-12 rounded object-cover" />}
              {i.kind === 'voice' && i.localUrl && <audio src={i.localUrl} controls className="h-9 max-w-[200px]" />}
              {i.kind === 'file' && <span className="truncate">{i.file_name}</span>}
              <span className="ml-auto text-xs text-slate-500">{i.uploading ? 'Uploading...' : i.error ? 'Failed' : 'Ready'}</span>
              <button
                type="button"
                className="rounded px-2 text-lg leading-none text-slate-500"
                aria-label="Remove"
                onClick={() => setItems((prev) => prev.filter((p) => p.key !== i.key))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function pickMime(): string {
  const options = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg'];
  if (typeof MediaRecorder === 'undefined') return '';
  return options.find((m) => MediaRecorder.isTypeSupported(m)) ?? '';
}

export function VoiceRecorder({ onRecorded, className }: { onRecorded: (f: File) => void; className?: string }) {
  const [rec, setRec] = useState<MediaRecorder | null>(null);
  const [secs, setSecs] = useState(0);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = pickMime();
      const r = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunks.current = [];
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      r.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const type = r.mimeType || mime || 'audio/webm';
        const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm';
        const blob = new Blob(chunks.current, { type: type.split(';')[0] });
        onRecorded(new File([blob], `voice-note-${Date.now()}.${ext}`, { type: type.split(';')[0] }));
      };
      r.start();
      setRec(r);
      setSecs(0);
      timer.current = setInterval(() => setSecs((s) => s + 1), 1000);
    } catch {
      alert('Microphone access is needed to record a voice note. Please allow it in your browser settings.');
    }
  }

  function stop() {
    rec?.stop();
    setRec(null);
    if (timer.current) clearInterval(timer.current);
  }

  if (rec) {
    return (
      <button type="button" onClick={stop} className={`${className} !border-red-500 !bg-red-600 !text-white`}>
        <span className="h-2 w-2 animate-pulse rounded-full bg-white" /> Stop {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')}
      </button>
    );
  }
  return (
    <button type="button" onClick={start} className={className}>
      Voice note
    </button>
  );
}
