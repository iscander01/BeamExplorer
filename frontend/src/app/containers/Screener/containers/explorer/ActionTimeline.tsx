import React, { useEffect, useMemo, useRef, useState } from 'react';
import { styled } from '@linaria/react';
import { theme } from './shared';
import { CenteredNote } from '../../components/CenteredNote';
import { CATEGORIES, methodCategory, type BansCategory } from './bansActions';
import type { ApiBansAction } from '../../api/types';

// Ticks (one per action — ~1000 on mainnet) are painted on a <canvas> rather
// than as SVG <line>s: a thousand individually-translucent SVG nodes made every
// scroll frame over this panel expensive to repaint. The canvas is redrawn only
// when the data, width or lane filter changes; axes, labels and the hover
// readout stay in the (now tiny) SVG / DOM.
const LANES = CATEGORIES;
const TICK_ALPHA = 0.55;
const PAD_L = 92;
const PAD_R = 16;
const PAD_T = 8;
const PAD_B = 26;
const LANE_H = 28;

interface Tick {
  x: number;
  laneIdx: number;
  action: ApiBansAction;
  color: string;
  category: BansCategory;
}

function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export const ActionTimeline: React.FC<{ actions: ApiBansAction[] }> = ({ actions }) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(720);
  const [hidden, setHidden] = useState<Set<BansCategory>>(new Set());
  const [hover, setHover] = useState<{ x: number; y: number; action: ApiBansAction } | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) setWidth(Math.floor(w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const height = PAD_T + LANES.length * LANE_H + PAD_B;
  const plotW = Math.max(width - PAD_L - PAD_R, 10);
  const laneY = (i: number): number => PAD_T + i * LANE_H;

  const { ticks, minMs, maxMs } = useMemo(() => {
    const laneIndex = new Map(LANES.map((l, i) => [l.key, i] as const));
    const parsed = actions
      .map((a) => ({ a, ms: Date.parse(a.block_ts), cat: methodCategory(a.method) }))
      .filter((x) => Number.isFinite(x.ms) && laneIndex.has(x.cat));
    if (parsed.length === 0) return { ticks: [] as Tick[], minMs: 0, maxMs: 0 };
    let lo = Infinity;
    let hi = -Infinity;
    for (const p of parsed) {
      if (p.ms < lo) lo = p.ms;
      if (p.ms > hi) hi = p.ms;
    }
    if (hi === lo) hi = lo + 1;
    const out: Tick[] = parsed.map((p) => {
      const laneIdx = laneIndex.get(p.cat)!;
      return {
        x: PAD_L + ((p.ms - lo) / (hi - lo)) * plotW,
        laneIdx,
        action: p.a,
        color: LANES[laneIdx]!.color,
        category: p.cat,
      };
    });
    return { ticks: out, minMs: lo, maxMs: hi };
  }, [actions, plotW]);

  const gridlines = useMemo(() => {
    if (maxMs <= minMs) return [] as { x: number; label: string }[];
    const N = 6;
    return Array.from({ length: N + 1 }, (_, i) => ({
      x: PAD_L + (plotW * i) / N,
      label: fmtDate(minMs + ((maxMs - minMs) * i) / N),
    }));
  }, [minMs, maxMs, plotW]);

  const visibleTicks = useMemo(() => ticks.filter((t) => !hidden.has(t.category)), [ticks, hidden]);

  // One stroke per tick, not one path per lane, so overlapping ticks still
  // stack their alpha — dense periods read darker, as they did in SVG.
  useEffect(() => {
    const cv = canvasRef.current;
    const ctx = cv?.getContext('2d');
    if (!cv || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = Math.round(width * dpr);
    cv.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.lineWidth = 2;
    ctx.globalAlpha = TICK_ALPHA;
    for (const t of visibleTicks) {
      const y = PAD_T + t.laneIdx * LANE_H;
      ctx.strokeStyle = t.color;
      ctx.beginPath();
      ctx.moveTo(t.x, y + 4);
      ctx.lineTo(t.x, y + LANE_H - 4);
      ctx.stroke();
    }
  }, [visibleTicks, width, height]);

  function onMove(e: React.MouseEvent<SVGSVGElement>): void {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const laneIdx = Math.floor((e.clientY - rect.top - PAD_T) / LANE_H);
    if (laneIdx < 0 || laneIdx >= LANES.length) {
      setHover(null);
      return;
    }
    let best: Tick | null = null;
    let bestDx = 12;
    for (const t of visibleTicks) {
      if (t.laneIdx !== laneIdx) continue;
      const dx = Math.abs(t.x - mx);
      if (dx < bestDx) {
        bestDx = dx;
        best = t;
      }
    }
    setHover(best ? { x: best.x, y: laneY(best.laneIdx) + LANE_H / 2, action: best.action } : null);
  }

  function toggle(cat: BansCategory): void {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  return (
    <Wrap ref={wrapRef}>
      <Legend>
        {LANES.map((l) => (
          <Chip key={l.key} type="button" data-off={hidden.has(l.key)} onClick={() => toggle(l.key)}>
            <Swatch style={{ background: l.color }} />
            {l.label}
          </Chip>
        ))}
      </Legend>

      <SvgWrap>
        <svg width={width} height={height} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
          {gridlines.map((g, i) => (
            <g key={`g${i}`}>
              <line
                x1={g.x}
                y1={PAD_T}
                x2={g.x}
                y2={PAD_T + LANES.length * LANE_H}
                stroke={theme.color.borderDim}
                strokeWidth={1}
              />
              {/* The last label sits on the right edge: anchor its end there so it isn't clipped. */}
              <text
                x={g.x}
                y={height - 8}
                fill={theme.color.muted}
                fontSize={10}
                textAnchor={i === gridlines.length - 1 ? 'end' : 'middle'}
              >
                {g.label}
              </text>
            </g>
          ))}
          {LANES.map((l, i) => (
            <g key={l.key}>
              <text
                x={PAD_L - 10}
                y={laneY(i) + LANE_H / 2 + 3}
                fill={theme.color.muted}
                fontSize={11}
                textAnchor="end"
              >
                {l.label}
              </text>
              <line
                x1={PAD_L}
                y1={laneY(i) + LANE_H}
                x2={width - PAD_R}
                y2={laneY(i) + LANE_H}
                stroke={theme.color.borderDim}
                strokeWidth={1}
                opacity={0.5}
              />
            </g>
          ))}
        </svg>
        <TickCanvas ref={canvasRef} style={{ width, height }} aria-hidden="true" />
        {hover && <HoverDot style={{ left: hover.x, top: hover.y }} />}

        {hover && (
          <Tip style={{ left: Math.min(hover.x + 10, Math.max(width - 170, 0)), top: hover.y - 6 }}>
            <TipName>{hover.action.name || '(no name)'}</TipName>
            <TipMeta>
              {hover.action.method} · h {hover.action.height}
            </TipMeta>
            <TipMeta>{fmtDate(Date.parse(hover.action.block_ts))}</TipMeta>
          </Tip>
        )}
      </SvgWrap>

      {ticks.length === 0 && (
        <CenteredNote pad="20px" size={12}>
          No actions to plot.
        </CenteredNote>
      )}
    </Wrap>
  );
};

export default ActionTimeline;

// --- styled ---------------------------------------------------------------
const Wrap = styled.div``;
const Legend = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  /* Per-chip right + bottom margins (not flexbox \`gap\`, which QtWebEngine 5.15.2
     / Chrome 83 lacks) give the chips comfortable spacing between each other and
     keep the rows apart when they wrap on a narrow panel / the wallet DApp. */
  margin: 2px 0 8px;
  & > * {
    margin-right: 10px;
    margin-bottom: 8px;
  }
`;
const Chip = styled.button`
  display: inline-flex;
  align-items: center;
  background: ${theme.color.surface2};
  border: 1px solid ${theme.color.borderDim};
  border-radius: 6px;
  padding: 3px 8px;
  color: ${theme.color.text};
  font-size: 11px;
  cursor: pointer;
  &[data-off='true'] {
    opacity: 0.4;
  }
`;
const Swatch = styled.span`
  width: 10px;
  height: 10px;
  border-radius: 2px;
  display: inline-block;
  /* Gap between the swatch and its label. Must live on the swatch itself: the
     label is a bare text node, so the Chip's sibling rule couldn't target it —
     which is why the swatch previously sat flush against the text. */
  margin-right: 6px;
`;
const SvgWrap = styled.div`
  position: relative;
  width: 100%;
  overflow-x: auto;
`;
// Above the SVG so ticks still draw over the gridlines; pointer-events: none
// lets the SVG underneath keep handling hover.
const TickCanvas = styled.canvas`
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
`;
const HoverDot = styled.span`
  position: absolute;
  width: 6px;
  height: 6px;
  margin: -3px 0 0 -3px;
  border-radius: 50%;
  background: ${theme.color.text};
  pointer-events: none;
`;
const Tip = styled.div`
  position: absolute;
  pointer-events: none;
  z-index: 5;
  background: ${theme.color.surface3};
  border: 1px solid ${theme.color.border};
  border-radius: 6px;
  padding: 6px 8px;
  font-size: 11px;
  color: ${theme.color.text};
  white-space: nowrap;
`;
const TipName = styled.div`
  color: ${theme.color.accent};
  font-weight: 600;
`;
const TipMeta = styled.div`
  color: ${theme.color.muted};
  font-size: 10px;
`;
