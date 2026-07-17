import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "./lib/axios";
import { formatDuration } from "./lib/format";
import { Button } from "./components/Button";
import { Table } from "./components/Table";

type Row = {
  id: number;
  title: string;
  preview: string;
  totalConversationTime: number | null;
  createdAt: string;
};

export function Transcripts() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => api.get<{ transcripts: Row[] }>("/transcripts").then((r) => setRows(r.data.transcripts));
  useEffect(() => {
    load();
  }, []);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const segments = JSON.parse(await file.text());
      await api.post("/transcripts", segments);
      await load();
    } catch {
      alert("Upload failed — is the file a valid transcript JSON array?");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const count = rows?.length ?? 0;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Transcripts</h1>
          <p className="mt-1 text-sm text-muted">
            {count === 0 ? "No transcripts yet" : `${count} ${count === 1 ? "call" : "calls"}`}
          </p>
        </div>
        <Button onClick={() => fileRef.current?.click()} disabled={uploading}>
          {uploading ? "Uploading…" : "Upload transcript"}
        </Button>
        <input ref={fileRef} type="file" accept="application/json" hidden onChange={onFile} />
      </div>

      {rows !== null && count === 0 ? (
        <EmptyState onUpload={() => fileRef.current?.click()} />
      ) : (
        <Table head={["Title", "Preview", "Length", "Created"]}>
          {(rows ?? []).map((r) => (
            <tr key={r.id} className="group border-b border-border transition-colors last:border-0 hover:bg-bg/60">
              <td className="px-5 py-3.5">
                <Link
                  to={`/transcripts/${r.id}`}
                  className="font-medium text-ink underline-offset-2 group-hover:text-primary group-hover:underline"
                >
                  {r.title}
                </Link>
              </td>
              <td className="max-w-sm truncate px-5 py-3.5 text-muted">{r.preview}</td>
              <td className="whitespace-nowrap px-5 py-3.5 font-mono text-[13px] text-ink">
                {formatDuration(r.totalConversationTime ?? 0)}
              </td>
              <td className="whitespace-nowrap px-5 py-3.5 text-muted">
                {new Date(r.createdAt).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}

function EmptyState({ onUpload }: { onUpload: () => void }) {
  return (
    <div className="flex flex-col items-center rounded-xl2 border border-dashed border-border bg-surface/60 px-6 py-16 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl2 bg-bg">
        <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
          {[7, 13, 5, 16, 9, 14, 6].map((h, i) => (
            <rect key={i} x={2 + i * 3} y={(22 - h) / 2} width="1.8" height={h} rx="0.9" fill="#5468D4" />
          ))}
        </svg>
      </div>
      <h2 className="text-base font-semibold text-ink">Upload your first transcript</h2>
      <p className="mt-1 max-w-sm text-sm text-muted">
        Drop in a JSON transcript to see its speech timeline, interruptions, and talk-time breakdown.
      </p>
      <div className="mt-5">
        <Button onClick={onUpload}>Upload transcript</Button>
      </div>
    </div>
  );
}
