import { Table } from "../Table";
import { formatDuration } from "../../lib/format";

type Segment = { id: number; role: "user" | "agent"; text: string; startedAt: number; endedAt: number };
export type Anomaly = {
  id: number;
  speechSegmentId: number;
  type: "interruption" | "silence";
  actionable: boolean;
  reason: string;
  recommendation: string | null;
};

const LANE_COLORS = {
  agent: { fill: "#DBEEDF", stroke: "#A9D8B4" },
  user: { fill: "#DCE5FA", stroke: "#B4C8F0" },
};

// Miniature two-lane glyph echoing the timeline above: a gap between lanes reads as
// silence, a coral tick at an overlap reads as an interruption — same grammar, no legend needed.
function PatternGlyph({ type }: { type: "interruption" | "silence" }) {
  const agent = LANE_COLORS.agent;
  const user = LANE_COLORS.user;
  return (
    <svg width={18} height={12} aria-hidden className="shrink-0">
      {type === "silence" ? (
        <>
          <rect x={0} y={1} width={7} height={4} rx={1.5} fill={agent.fill} stroke={agent.stroke} />
          <rect x={11} y={7} width={7} height={4} rx={1.5} fill={user.fill} stroke={user.stroke} />
        </>
      ) : (
        <>
          <rect x={0} y={1} width={11} height={4} rx={1.5} fill={agent.fill} stroke={agent.stroke} />
          <rect x={7} y={7} width={11} height={4} rx={1.5} fill={user.fill} stroke={user.stroke} />
          <line x1={9} y1={0} x2={9} y2={12} stroke="#F76B5E" strokeWidth={1.5} />
        </>
      )}
    </svg>
  );
}

function TypeBadge({ type }: { type: "interruption" | "silence" }) {
  const cls = type === "interruption" ? "bg-accent/10 text-accent" : "bg-bg text-muted";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full py-0.5 pl-1 pr-2.5 text-xs font-semibold ${cls}`}>
      <PatternGlyph type={type} />
      {type === "interruption" ? "Interruption" : "Silence"}
    </span>
  );
}

function ActionableMark({ actionable }: { actionable: boolean }) {
  if (!actionable) return <span className="text-xs text-muted">—</span>;
  return <span className="text-xs font-semibold text-primary">Follow up</span>;
}

export function Anomalies({ anomalies, segments }: { anomalies: Anomaly[]; segments: Segment[] }) {
  if (anomalies.length === 0) return <div className="text-sm text-muted">No anomalies detected.</div>;

  const byId = new Map(segments.map((s) => [s.id, s]));
  return (
    <Table head={["Type", "Timestamp", "Content", "Reason", "Actionable", "Recommendation"]}>
      {anomalies.map((a) => {
        const seg = byId.get(a.speechSegmentId);
        if (!seg) return null;
        // silence starts where the prior segment ended; interruption starts with the customer's segment
        const ts = a.type === "silence" ? seg.endedAt : seg.startedAt;
        return (
          <tr
            key={a.id}
            className={
              "border-b border-border last:border-b-0 align-top hover:bg-bg/40 " +
              (a.actionable ? "border-l-2 border-l-primary" : "")
            }
          >
            <td className="px-5 py-3">
              <TypeBadge type={a.type} />
            </td>
            <td className="px-5 py-3 font-mono text-xs tabular-nums text-muted">{formatDuration(ts)}</td>
            <td className="px-5 py-3">
              <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
                {seg.role === "agent" ? "Agent" : "User"}
              </div>
              <div className="text-ink">{seg.text}</div>
            </td>
            <td className="px-5 py-3 text-ink">{a.reason}</td>
            <td className="px-5 py-3">
              <ActionableMark actionable={a.actionable} />
            </td>
            <td className="px-5 py-3 text-ink">{a.recommendation ?? "—"}</td>
          </tr>
        );
      })}
    </Table>
  );
}
