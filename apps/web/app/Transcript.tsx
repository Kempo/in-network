import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "./lib/axios";
import { Statistics } from "./components/transcripts/Statistics";
import { Graph } from "./components/transcripts/Graph";
import { Anomalies, type Anomaly } from "./components/transcripts/Anomalies";

type Segment = { id: number; role: "user" | "agent"; text: string; startedAt: number; endedAt: number };
type Analysis = {
  totalConversationTime: number;
  totalTalkingTime: number;
  numberOfInterruptions: number;
  totalSilence: number;
};
type Detail = {
  transcript: { id: number; title: string };
  segments: Segment[];
  analysis: Analysis | null;
  anomalies: Anomaly[];
};

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <div className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted">{children}</div>;
}

export function Transcript() {
  const { id } = useParams();
  const [data, setData] = useState<Detail | null>(null);

  useEffect(() => {
    api.get<Detail>(`/transcripts/${id}`).then((r) => setData(r.data));
  }, [id]);

  if (!data) return <div className="mx-auto max-w-5xl px-6 py-10 text-sm text-muted">Loading…</div>;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted hover:text-primary">
        <span aria-hidden>←</span> Dashboard
      </Link>
      <h1 className="mb-8 mt-3 text-2xl font-semibold tracking-tight text-ink">{data.transcript.title}</h1>

      <section className="mb-10">
        <Eyebrow>Overview</Eyebrow>
        {data.analysis && <Statistics analysis={data.analysis} />}
      </section>

      <section>
        <Eyebrow>Speech activity timeline</Eyebrow>
        <Graph segments={data.segments} />
      </section>

      <section className="mt-10">
        <Eyebrow>Analysis</Eyebrow>
        <Anomalies anomalies={data.anomalies} segments={data.segments} />
      </section>
    </div>
  );
}
