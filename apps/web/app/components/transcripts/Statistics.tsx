import { formatDuration } from "../../lib/format";

type Analysis = {
  totalConversationTime: number;
  totalTalkingTime: number;
  numberOfInterruptions: number;
  totalSilence: number;
};

function Tile({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl2 border border-border bg-surface p-5 shadow-card">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</div>
      <div className={"mt-2 text-2xl font-semibold tabular-nums " + (accent ? "text-accent" : "text-ink")}>
        {value}
      </div>
    </div>
  );
}

export function Statistics({ analysis }: { analysis: Analysis }) {
  const talkPct = analysis.totalConversationTime
    ? Math.round((analysis.totalTalkingTime / analysis.totalConversationTime) * 100)
    : 0;
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <Tile label="Total call length" value={formatDuration(analysis.totalConversationTime)} />
      <Tile label={`Talking time · ${talkPct}%`} value={formatDuration(analysis.totalTalkingTime)} />
      <Tile
        label="Interruptions"
        value={String(analysis.numberOfInterruptions)}
        accent={analysis.numberOfInterruptions > 0}
      />
      <Tile label="Total silence" value={formatDuration(analysis.totalSilence)} />
    </div>
  );
}
