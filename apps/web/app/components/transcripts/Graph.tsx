import { scaleLinear } from "@visx/scale";
import { Group } from "@visx/group";
import { Bar } from "@visx/shape";
import { AxisBottom } from "@visx/axis";
import { useTooltip, TooltipWithBounds, defaultStyles } from "@visx/tooltip";

type Segment = { id: number; role: "user" | "agent"; text: string; startedAt: number; endedAt: number };

const WIDTH = 860;
const LANE_H = 46;
const GAP = 22; // room between lanes for interruption ticks
const AXIS_H = 28;
const PAD = 16;
const TOP = 24; // space for lane labels
const HEIGHT = TOP + LANE_H * 2 + GAP + AXIS_H + PAD;

const COLORS = {
  agent: { fill: "#DBEEDF", stroke: "#A9D8B4" },
  user: { fill: "#DCE5FA", stroke: "#B4C8F0" },
  accent: "#F76B5E",
};

// Points (ms) where a speaker starts while the other is still talking.
function interruptionPoints(segments: Segment[]): number[] {
  const o = [...segments].sort((a, b) => a.startedAt - b.startedAt);
  const points: number[] = [];
  if (o.length === 0) return points;
  let curr = o[0];
  for (let i = 1; i < o.length; i++) {
    const next = o[i];
    if (next.startedAt < curr.endedAt && next.role !== curr.role) points.push(next.startedAt);
    if (curr.endedAt < next.endedAt) curr = next;
  }
  return points;
}

export function Graph({ segments }: { segments: Segment[] }) {
  const { tooltipData, tooltipLeft, tooltipTop, tooltipOpen, showTooltip, hideTooltip } =
    useTooltip<Segment>();

  if (segments.length === 0) return <div className="text-sm text-muted">No speech segments.</div>;

  const minStart = Math.min(...segments.map((s) => s.startedAt));
  const maxEnd = Math.max(...segments.map((s) => s.endedAt));
  const x = scaleLinear({ domain: [minStart, maxEnd], range: [PAD, WIDTH - PAD] });
  const laneTop = (role: "agent" | "user") => TOP + (role === "agent" ? 0 : LANE_H + GAP);
  const ticks = x.ticks(7);
  const interruptions = interruptionPoints(segments);

  return (
    <div className="rounded-xl2 border border-border bg-surface p-5 shadow-card">
      <div className="relative overflow-x-auto">
        <svg width={WIDTH} height={HEIGHT} className="min-w-full">
          {/* gridlines */}
          {ticks.map((t) => (
            <line key={`g${t}`} x1={x(t)} x2={x(t)} y1={TOP} y2={TOP + LANE_H * 2 + GAP} stroke="#EEF0FA" />
          ))}

          {/* lanes */}
          {(["agent", "user"] as const).map((role) => (
            <Group key={role}>
              <text x={PAD} y={laneTop(role) - 7} fontSize={11} fontWeight={600} fill="#6B7280">
                {role === "agent" ? "Agent" : "User"}
              </text>
              <rect x={PAD} y={laneTop(role)} width={WIDTH - PAD * 2} height={LANE_H} rx={9} fill="#F6F7FC" />
            </Group>
          ))}

          {/* segment bars */}
          {segments.map((s) => {
            const left = x(s.startedAt);
            const w = Math.max(2, x(s.endedAt) - x(s.startedAt));
            const c = COLORS[s.role];
            return (
              <Bar
                key={s.id}
                x={left}
                y={laneTop(s.role) + 7}
                width={w}
                height={LANE_H - 14}
                rx={6}
                fill={c.fill}
                stroke={c.stroke}
                className="cursor-default"
                onMouseMove={() =>
                  showTooltip({ tooltipData: s, tooltipLeft: left + w / 2, tooltipTop: laneTop(s.role) })
                }
                onMouseLeave={hideTooltip}
              />
            );
          })}

          {/* interruption markers — coral ticks in the divider where a speaker cut in */}
          {interruptions.map((ms, i) => (
            <line
              key={`int${i}`}
              x1={x(ms)}
              x2={x(ms)}
              y1={laneTop("agent") + LANE_H}
              y2={laneTop("user")}
              stroke={COLORS.accent}
              strokeWidth={2}
            />
          ))}

          <AxisBottom
            top={TOP + LANE_H * 2 + GAP}
            scale={x}
            tickValues={ticks}
            tickFormat={(v) => `${Math.round(Number(v) / 1000)}s`}
            stroke="#E5E7F2"
            tickStroke="#E5E7F2"
            tickLabelProps={() => ({
              fill: "#6B7280",
              fontSize: 11,
              fontFamily: "ui-monospace, monospace",
              textAnchor: "middle",
            })}
          />
        </svg>

        {tooltipOpen && tooltipData && (
          <TooltipWithBounds left={tooltipLeft} top={tooltipTop} style={{ ...defaultStyles, maxWidth: 280 }}>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
              {tooltipData.role}
            </span>
            <div className="text-sm text-ink">{tooltipData.text}</div>
          </TooltipWithBounds>
        )}
      </div>

      <Legend interruptions={interruptions.length} />
    </div>
  );
}

function Legend({ interruptions }: { interruptions: number }) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border pt-3 text-xs text-muted">
      <Swatch fill="#DCE5FA" stroke="#B4C8F0" label="User speech" />
      <Swatch fill="#DBEEDF" stroke="#A9D8B4" label="Agent speech" />
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block h-3 w-0.5 bg-accent" />
        {interruptions > 0 ? `Interruption (${interruptions})` : "Interruption"}
      </span>
    </div>
  );
}

function Swatch({ fill, stroke, label }: { fill: string; stroke: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block h-3 w-3 rounded-sm border" style={{ background: fill, borderColor: stroke }} />
      {label}
    </span>
  );
}
