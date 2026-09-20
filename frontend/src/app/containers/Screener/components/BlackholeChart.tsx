import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LineStyle, LineType, type LineData, type LineSeriesPartialOptions, type UTCTimestamp } from 'lightweight-charts';
import AssetIcon, { normalizeOptColor } from '@app/shared/components/AssetsIcon';
import { AssetAid, assetLabel } from '@app/shared/components/AssetLabel';
import { PALLETE_ASSETS } from '@app/shared/constants';
import type { ApiBlackholeSeries, ApiKeyedSeries } from '../api/client';
import type { ApiAssetListEntry } from '../api/types';
import { useSharedAssets } from '../assetColors';
import { fmtDayLocal, fmtNativeUnits } from './format';
import { KeyedLinesChart, type KeyedChartHandle } from './KeyedLinesChart';
import {
  ArrowButton,
  ArrowIcon,
  MarkerAnchor,
  MarkerChip,
  PopDesc,
  PopHeader,
  PopName,
  PopNameMain,
  PopNameSub,
  PopRow,
  PopTitle,
  Popover,
  Strip,
} from './assetMarkerStrip';

// Colour per asset — the asset's brand colour (OPT_COLOR) when known, otherwise
// the same per-aid palette slot AssetIcon falls back to, so the line, its legend
// swatch, and the asset icon all share one colour. Exported so the SVG/PNG
// export agrees with the on-screen chart.
export function buildBlackholeColors(series: ReadonlyArray<ApiBlackholeSeries>): Map<number, string> {
  const map = new Map<number, string>();
  for (const s of series) {
    const color = normalizeOptColor(s.color) ?? PALLETE_ASSETS[s.aid] ?? PALLETE_ASSETS[s.aid % PALLETE_ASSETS.length]!;
    map.set(s.aid, color);
  }
  return map;
}

export type BlackholeLineStyle = 'solid' | 'dashed' | 'dotted' | 'large-dashed';
const STYLE_CYCLE: BlackholeLineStyle[] = ['solid', 'dashed', 'dotted', 'large-dashed'];

// Paired confidential assets are burned in lockstep, so their cumulative curves
// coincide and draw on the same pixels — one line hides the other. Bucket series
// by final value (~3 significant figures) and give each member of a multi-asset
// bucket a distinct line style, so overlapping lines stay individually legible.
// Exported so the chart, legend, and SVG/PNG export agree on the assignment.
export function buildBlackholeLineStyles(series: ReadonlyArray<ApiBlackholeSeries>): Map<number, BlackholeLineStyle> {
  const buckets = new Map<string, number[]>();
  for (const s of series) {
    const v = s.points[s.points.length - 1]?.value ?? 0;
    const key = v === 0 ? '0' : v.toPrecision(3);
    const list = buckets.get(key);
    if (list) list.push(s.aid);
    else buckets.set(key, [s.aid]);
  }
  const out = new Map<number, BlackholeLineStyle>();
  for (const aids of buckets.values()) {
    aids.forEach((aid, i) => out.set(aid, aids.length > 1 ? STYLE_CYCLE[i % STYLE_CYCLE.length]! : 'solid'));
  }
  return out;
}

const LINE_STYLE_ENUM: Record<BlackholeLineStyle, LineStyle> = {
  solid: LineStyle.Solid,
  dashed: LineStyle.Dashed,
  dotted: LineStyle.Dotted,
  'large-dashed': LineStyle.LargeDashed,
};
// CSS border-style for the legend swatch (CSS has no large-dashed → dashed).
const LINE_STYLE_CSS: Record<BlackholeLineStyle, React.CSSProperties['borderTopStyle']> = {
  solid: 'solid',
  dashed: 'dashed',
  dotted: 'dotted',
  'large-dashed': 'dashed',
};
// SVG stroke-dasharray for the PNG/SVG export ('' = solid).
export const LINE_STYLE_DASH: Record<BlackholeLineStyle, string> = {
  solid: '',
  dashed: '6 4',
  dotted: '2 3',
  'large-dashed': '10 5',
};

const ICON_PX = 20;
const POPOVER_W = 220;

// lightweight-charts spaces bars by *index*, not by elapsed time. Each asset
// contributes only a handful of deposits at irregular moments, so plotting the
// raw points makes one pixel worth anything from an hour to a year — the axis
// is distorted and the crosshair leaps months between adjacent pixels. Forward
// -fill every series onto one shared, near-uniform grid (all real event
// timestamps, plus a regular step between them) so the cursor moves smoothly
// and every asset has a readable value at whatever instant is hovered.
const GRID_TARGET_POINTS = 600;

export function resampleBlackhole(series: ReadonlyArray<ApiBlackholeSeries>): Map<number, LineData[]> {
  const out = new Map<number, LineData[]>();
  const times = new Set<number>();
  let min = Infinity;
  let max = -Infinity;
  for (const s of series) {
    for (const p of s.points) {
      times.add(p.ts);
      if (p.ts < min) min = p.ts;
      if (p.ts > max) max = p.ts;
    }
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return out;
  const step = Math.max(60, Math.floor((max - min) / GRID_TARGET_POINTS));
  for (let t = min + step; t < max; t += step) times.add(t);
  const grid = Array.from(times).sort((a, b) => a - b);

  for (const s of series) {
    const pts = s.points.slice().sort((a, b) => a.ts - b.ts);
    const data: LineData[] = [];
    let i = 0;
    let cur: number | null = null;
    for (const t of grid) {
      while (i < pts.length && pts[i]!.ts <= t) {
        cur = pts[i]!.value;
        i += 1;
      }
      // Nothing burned yet — the line starts at the asset's first deposit.
      if (cur == null) continue;
      data.push({ time: t as UTCTimestamp, value: cur });
    }
    out.set(s.aid, data);
  }
  return out;
}

function fmtBurned(v: number): string {
  return v.toLocaleString('en-US', { maximumFractionDigits: v >= 1 ? 2 : 8 });
}

interface Props {
  series: ReadonlyArray<ApiBlackholeSeries>;
  logScale?: boolean;
  formatter?: (v: number) => string;
  /** Render the line-end asset-icon overlay (hover for metadata + amount
   *  burned, click to open the asset). Only enabled in the expanded modal —
   *  15 icons don't fit a 320px grid cell, which keeps its colour legend. */
  showMarkers?: boolean;
}

/** One cumulative burn line per asset, on the keyed multi-line chart: aids are
 *  the series keys, paired assets get distinct line styles, and the expanded
 *  view pins each asset's icon to its line's begin. */
export const BlackholeChart: React.FC<Props> = ({
  series,
  logScale = false,
  formatter = fmtNativeUnits,
  showMarkers = false,
}) => {
  const handleRef = useRef<KeyedChartHandle | null>(null);
  const markerNodes = useRef<Map<number, HTMLDivElement>>(new Map());
  // Latest screen position per visible marker — read by the popover.
  const placedRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  // Last-written transform signature per marker, so the per-frame reposition
  // loop only touches the DOM when a marker actually moves.
  const writtenRef = useRef<Map<number, string>>(new Map());
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [hoverAid, setHoverAid] = useState<number | null>(null);
  const hoverTimer = useRef<number | null>(null);
  const navigate = useNavigate();

  const { data: assetsData } = useSharedAssets();
  const metaByAid = useMemo(() => {
    const map = new Map<number, ApiAssetListEntry>();
    if (assetsData) for (const a of assetsData.assets) map.set(a.aid, a);
    return map;
  }, [assetsData]);

  // Stable colour + line style per asset (series order is stable per load).
  const colorByAid = useMemo(() => buildBlackholeColors(series), [series]);
  const styleByAid = useMemo(() => buildBlackholeLineStyles(series), [series]);

  // The keyed chart identifies a line by string key: the aid.
  const keyed = useMemo<ApiKeyedSeries[]>(
    () => series.map((s) => ({ key: String(s.aid), label: s.label, points: s.points })),
    [series],
  );
  const colors = useMemo(() => {
    const m = new Map<string, string>();
    for (const [aid, c] of colorByAid) m.set(String(aid), c);
    return m;
  }, [colorByAid]);
  // Uniform-grid line data (see resampleBlackhole) — what actually gets plotted.
  // `series` keeps its raw points for the legend, markers and popover.
  const chartData = useMemo(() => {
    const m = new Map<string, LineData[]>();
    for (const [aid, d] of resampleBlackhole(series)) m.set(String(aid), d);
    return m;
  }, [series]);
  const lineOptions = useCallback(
    (key: string): LineSeriesPartialOptions => ({
      lineStyle: LINE_STYLE_ENUM[styleByAid.get(Number(key)) ?? 'solid'],
      // A burn is a discrete jump, not a ramp — and never a curve, whose
      // overshoot would draw a dip the balance can't actually take.
      lineType: LineType.WithSteps,
    }),
    [styleByAid],
  );
  const swatchStyle = useCallback(
    (key: string): React.CSSProperties => ({ borderTopStyle: LINE_STYLE_CSS[styleByAid.get(Number(key)) ?? 'solid'] }),
    [styleByAid],
  );
  const rowLabel = useCallback((s: ApiKeyedSeries): string => assetLabel(Number(s.key), s.label), []);
  const legendExtra = useCallback((s: ApiKeyedSeries): React.ReactNode => <AssetAid>(#{s.key})</AssetAid>, []);
  // A hidden series shouldn't keep its popover open.
  const onHiddenChange = useCallback((next: Set<string>): void => {
    setHidden(next);
    setHoverAid((cur) => (cur != null && next.has(String(cur)) ? null : cur));
  }, []);

  // Imperative reposition: every icon sits at its line's BEGIN — the first
  // point's (timeToCoordinate, priceToCoordinate). Markers whose begin is
  // scrolled out of the plot are hidden; the few that still overlap (e.g. paired
  // assets whose first deposits coincide) are nudged apart vertically.
  const updatePositions = useCallback((): void => {
    const h = handleRef.current;
    if (!h) return;
    const ts = h.chart.timeScale();
    const plotW = ts.width();
    // priceToCoordinate maps into the price pane, which sits *above* the
    // time-axis strip; exclude that strip so icons stay inside the plot.
    const paneH = Math.max(0, h.host.clientHeight - ts.height());
    const half = ICON_PX / 2;

    const placed: Array<{ aid: number; x: number; y: number }> = [];
    for (const s of series) {
      if (hidden.has(String(s.aid))) continue;
      const line = h.series.get(String(s.aid));
      const first = s.points[0];
      if (!line || !first) continue;
      const x = ts.timeToCoordinate(first.ts as UTCTimestamp);
      const y = line.priceToCoordinate(first.value);
      // Drop markers whose begin is off the plot in either axis (±1px grace so a
      // begin resting on the left edge in a zoomed timeframe doesn't flicker).
      if (x == null || y == null || x < -1 || x > plotW + 1 || y < 0 || y > paneH) continue;
      placed.push({ aid: s.aid, x, y });
    }
    // Nudge icons that overlap in *both* axes downward until clear. Begins are
    // mostly scattered, so only near-coincident ones move. O(n²), n≈15.
    placed.sort((a, b) => a.y - b.y);
    const minGap = ICON_PX + 1;
    for (let i = 0; i < placed.length; i += 1) {
      for (let j = 0; j < i; j += 1) {
        if (Math.abs(placed[i]!.x - placed[j]!.x) < ICON_PX && placed[i]!.y < placed[j]!.y + minGap) {
          placed[i]!.y = placed[j]!.y + minGap;
        }
      }
    }

    const next = new Map<number, { x: number; y: number }>();
    const written = writtenRef.current;
    const posByAid = new Map(placed.map((p) => [p.aid, p]));
    for (const s of series) {
      const el = markerNodes.current.get(s.aid);
      if (!el) continue;
      const p = posByAid.get(s.aid);
      if (!p) {
        if (written.get(s.aid) !== 'hidden') {
          el.style.display = 'none';
          written.set(s.aid, 'hidden');
        }
        continue;
      }
      const cx = Math.min(Math.max(p.x, half), plotW - half);
      const cy = Math.min(Math.max(p.y, half), paneH - half);
      const sig = `${cx.toFixed(1)}:${cy.toFixed(1)}`;
      if (written.get(s.aid) !== sig) {
        el.style.display = '';
        el.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
        written.set(s.aid, sig);
      }
      next.set(s.aid, { x: cx, y: cy });
    }
    placedRef.current = next;
  }, [series, hidden]);

  const updatePositionsRef = useRef(updatePositions);
  useEffect(() => {
    updatePositionsRef.current = updatePositions;
  }, [updatePositions]);

  // Keep the line-end icons glued to the lines every frame. lightweight-charts
  // fires no event for price-scale (vertical) pan/zoom or autoScale settling,
  // so the time-range subscriptions alone left icons stranded on vertical
  // moves. A rAF poll is the only thing that tracks every coordinate change;
  // updatePositions writes to the DOM only when a marker actually moves, so an
  // idle chart costs just the coordinate reads, and the browser pauses rAF when
  // the tab is hidden. Only runs when the icon overlay is shown.
  useEffect(() => {
    if (!showMarkers) return undefined;
    let raf = requestAnimationFrame(function tick() {
      updatePositionsRef.current();
      raf = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(raf);
  }, [showMarkers]);

  useEffect(
    () => () => {
      if (hoverTimer.current != null) window.clearTimeout(hoverTimer.current);
    },
    [],
  );

  const openHover = useCallback((aid: number): void => {
    if (hoverTimer.current != null) window.clearTimeout(hoverTimer.current);
    setHoverAid(aid);
  }, []);
  const closeHoverSoon = useCallback((): void => {
    if (hoverTimer.current != null) window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => setHoverAid(null), 120);
  }, []);

  const go = (aid: number): void => navigate(`/asset/${aid}`);

  const hoverPos = hoverAid != null ? placedRef.current.get(hoverAid) : undefined;
  const hoverMeta = hoverAid != null ? metaByAid.get(hoverAid) : undefined;
  const hoverSeries = hoverAid != null ? series.find((s) => s.aid === hoverAid) : undefined;
  // Begin markers can sit anywhere; open the popover toward whichever side has
  // room (it spilled off the left edge when forced left for a left-side icon).
  const hoverRight = hoverPos != null && hoverPos.x + 12 + POPOVER_W <= (handleRef.current?.host.clientWidth ?? 0);

  return (
    <KeyedLinesChart
      series={keyed}
      logScale={logScale}
      formatter={formatter}
      colors={colors}
      data={chartData}
      lineOptions={lineOptions}
      rowLabel={rowLabel}
      windowRows
      legendExtra={legendExtra}
      swatchStyle={swatchStyle}
      hidden={hidden}
      onHiddenChange={onHiddenChange}
      handleRef={handleRef}
    >
      {showMarkers ? (
        <Strip>
          {series.map((s) => {
            const meta = metaByAid.get(s.aid);
            return (
              <MarkerAnchor
                key={s.aid}
                anchor="top"
                ref={(el) => {
                  if (el) markerNodes.current.set(s.aid, el);
                  else markerNodes.current.delete(s.aid);
                }}
                style={{ display: 'none' }}
              >
                <MarkerChip
                  anchor="top"
                  size={ICON_PX}
                  role="button"
                  tabIndex={0}
                  aria-label={`Open ${s.label} (#${s.aid})`}
                  onMouseEnter={() => openHover(s.aid)}
                  onMouseLeave={closeHoverSoon}
                  onFocus={() => openHover(s.aid)}
                  onBlur={closeHoverSoon}
                  onClick={() => go(s.aid)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      go(s.aid);
                    }
                  }}
                >
                  <AssetIcon
                    asset_id={s.aid}
                    color={s.color ?? meta?.color ?? null}
                    logoUrl={meta?.logo_url ?? null}
                    size={ICON_PX}
                  />
                </MarkerChip>
              </MarkerAnchor>
            );
          })}
          {hoverAid != null && hoverPos && hoverSeries ? (
            <Popover
              w={POPOVER_W}
              style={
                hoverRight
                  ? { left: `${hoverPos.x + 12}px`, top: `${hoverPos.y}px`, transform: 'translateY(-50%)' }
                  : {
                      left: `${Math.max(4, hoverPos.x - 12)}px`,
                      top: `${hoverPos.y}px`,
                      transform: 'translate(-100%, -50%)',
                    }
              }
              onMouseEnter={() => openHover(hoverAid)}
              onMouseLeave={closeHoverSoon}
            >
              <PopHeader>
                <PopTitle icon={22}>
                  <span className="icon">
                    <AssetIcon
                      asset_id={hoverAid}
                      color={hoverSeries.color ?? hoverMeta?.color ?? null}
                      logoUrl={hoverMeta?.logo_url ?? null}
                      size={22}
                    />
                  </span>
                  <PopName>
                    <PopNameMain>{hoverMeta?.name ?? hoverSeries.label}</PopNameMain>
                    <PopNameSub>
                      {[assetLabel(hoverAid, hoverMeta?.short_name ?? hoverSeries.label), hoverMeta?.unit_name]
                        .filter(Boolean)
                        .join(' · ')}
                    </PopNameSub>
                  </PopName>
                </PopTitle>
                <ArrowButton
                  type="button"
                  onClick={() => go(hoverAid)}
                  title="Open asset details"
                  aria-label="Open asset details"
                >
                  <ArrowIcon />
                </ArrowButton>
              </PopHeader>
              <PopRow>
                <span>Burned</span>
                <span className="v">
                  {fmtBurned(hoverSeries.points[hoverSeries.points.length - 1]?.value ?? 0)} {hoverSeries.label}
                </span>
              </PopRow>
              <PopRow>
                <span>First burn</span>
                <span className="v">{fmtDayLocal(hoverSeries.points[0]!.ts)}</span>
              </PopRow>
              {hoverMeta ? (
                <PopRow>
                  <span>Pools</span>
                  <span className="v">{hoverMeta.pool_count}</span>
                </PopRow>
              ) : null}
              {hoverMeta?.description ? <PopDesc>{hoverMeta.description}</PopDesc> : null}
            </Popover>
          ) : null}
        </Strip>
      ) : null}
    </KeyedLinesChart>
  );
};
