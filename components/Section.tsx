export default function Section({
  title,
  color,
  count,
  right,
  children,
  id,
}: {
  title: string;
  color: string;
  count?: number;
  right?: React.ReactNode;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className="card overflow-hidden">
      <h2 className={`section-title ${color}`}>
        <span>{title}</span>
        {typeof count === 'number' && (
          <span className="rounded-full bg-white px-2.5 py-0.5 text-sm font-black text-slate-900">{count}</span>
        )}
        {right && <span className="ml-auto text-xs font-semibold normal-case tracking-normal opacity-90">{right}</span>}
      </h2>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm italic text-slate-500">{children}</p>;
}
