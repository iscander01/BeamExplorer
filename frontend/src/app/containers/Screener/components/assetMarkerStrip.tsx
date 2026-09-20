import React from 'react';
import { styled } from '@linaria/react';

// Asset icon markers drawn over a chart plot, with a hover popover. Shared by the
// charts that pin an icon to a point on the plot: anchored from the plot's top
// edge (a line's begin) or from its bottom edge (a lane above the time axis).

export type MarkerAnchorSide = 'top' | 'bottom';

// Overlay layer. Spelled-out edges (no `inset` shorthand on Chrome 83).
// pointer-events:none so panning passes through; the chips re-enable it for
// themselves. Explicit z-index keeps the icons above the chart's canvas-rendered
// date axis instead of being painted under it.
export const Strip = styled.div`
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  pointer-events: none;
  z-index: 2;
`;

// Zero-size anchor positioned imperatively via translate3d (compositor-only,
// no reflow per frame) and carrying no transition, so the icon never smears
// while the chart is dragged. A `top` anchor is placed from the plot's top-left;
// a `bottom` anchor takes its lane offset from an inline `bottom`.
export const MarkerAnchor = styled.div<{ anchor: MarkerAnchorSide }>`
  position: absolute;
  top: ${(p) => (p.anchor === 'top' ? '0' : 'auto')};
  left: 0;
  width: 0;
  height: 0;
`;

// The visible chip, centred on its anchor. The :hover scale composes via a CSS
// custom property so the centring transform never needs to be re-stated; the
// 120ms transition lives here (on the scale), kept off the anchor so pan
// movement is instant, not animated.
export const MarkerChip = styled.div<{ anchor: MarkerAnchorSide; size: number }>`
  --marker-scale: 1;
  position: absolute;
  left: 0;
  top: ${(p) => (p.anchor === 'top' ? '0' : 'auto')};
  bottom: ${(p) => (p.anchor === 'bottom' ? '0' : 'auto')};
  width: ${(p) => `${p.size}px`};
  height: ${(p) => `${p.size}px`};
  transform: translate(-50%, ${(p) => (p.anchor === 'top' ? '-50%' : '50%')}) scale(var(--marker-scale));
  pointer-events: auto;
  cursor: pointer;
  border-radius: 50%;
  background: #042548;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.18), 0 1px 2px rgba(0, 0, 0, 0.6);
  transition: transform 120ms, box-shadow 120ms;

  & > * {
    margin: 0 !important;
    width: 100% !important;
    height: 100% !important;
  }

  /* Kept as two separate blocks: :focus-visible is Chrome 86+, and inside a
     selector list it would invalidate the whole rule in the wallet (Chrome 83),
     killing the :hover state too. */
  &:hover {
    --marker-scale: 1.18;
    box-shadow: 0 0 0 1px rgba(0, 246, 210, 0.65), 0 2px 6px rgba(0, 0, 0, 0.7);
    z-index: 5;
    outline: none;
  }

  &:focus-visible {
    --marker-scale: 1.18;
    box-shadow: 0 0 0 1px rgba(0, 246, 210, 0.65), 0 2px 6px rgba(0, 0, 0, 0.7);
    z-index: 5;
    outline: none;
  }
`;

export const Popover = styled.div<{ w: number }>`
  position: absolute;
  z-index: 20;
  width: ${(p) => `${p.w}px`};
  background: #0a3163;
  border: 1px solid rgba(0, 246, 210, 0.35);
  border-radius: 8px;
  padding: 10px 12px;
  color: rgba(255, 255, 255, 0.92);
  font-family: var(--font-mono);
  font-size: 12px;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.55);
  pointer-events: auto;
`;

export const PopHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;

  & > * + * {
    margin-left: 8px;
  }
`;

export const PopTitle = styled.div<{ icon: number }>`
  display: flex;
  align-items: center;
  min-width: 0;

  & > .icon {
    flex-shrink: 0;
    width: ${(p) => `${p.icon}px`};
    height: ${(p) => `${p.icon}px`};
    margin-right: 8px;
  }
  & > .icon > * {
    margin: 0 !important;
  }
`;

export const PopName = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
`;

export const PopNameMain = styled.div`
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

export const PopNameSub = styled.div`
  font-size: 10px;
  color: rgba(255, 255, 255, 0.55);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

export const ArrowButton = styled.button`
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 246, 210, 0.12);
  color: #00f6d2;
  border: 1px solid rgba(0, 246, 210, 0.45);
  border-radius: 4px;
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;

  &:hover {
    background: rgba(0, 246, 210, 0.22);
    border-color: rgba(0, 246, 210, 0.75);
  }
`;

export const PopRow = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.65);
  & + & {
    margin-top: 2px;
  }

  & > .v {
    color: rgba(255, 255, 255, 0.92);
    margin-left: 8px;
  }
`;

export const PopDesc = styled.div`
  margin-top: 6px;
  font-size: 11px;
  line-height: 1.35;
  color: rgba(255, 255, 255, 0.7);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

export const ArrowIcon: React.FC = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 12 12"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="2" y1="6" x2="10" y2="6" />
    <polyline points="6 2 10 6 6 10" />
  </svg>
);
