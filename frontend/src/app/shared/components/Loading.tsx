import React from 'react';
import { styled } from '@linaria/react';

// Shared loading indicator: a spinning ring whose arc fades from transparent
// through BEAM sky-blue to cyan (the logo's colours), with an optional label.
//   <Loading />                          centred block, page-level
//   <Loading size="sm" />                centred block inside cards/sections
//   <Loading inline label="Loading…" />  ring + text on one line
// conic-gradient + -webkit-mask both work in the wallet's Chrome 83.

type Size = 'sm' | 'md';

const RING: Record<Size, number> = { sm: 20, md: 30 };

const Block = styled.div<{ pad: string }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: ${(p) => p.pad};
  color: rgba(255, 255, 255, 0.55);
  text-align: center;
`;

const Inline = styled.span`
  display: inline-flex;
  align-items: center;
  vertical-align: middle;
  color: rgba(255, 255, 255, 0.55);
`;

const Ring = styled.span<{ px: number }>`
  display: inline-block;
  flex-shrink: 0;
  width: ${(p) => `${p.px}px`};
  height: ${(p) => `${p.px}px`};
  border-radius: 50%;
  background: conic-gradient(
    from 0deg,
    rgba(37, 193, 255, 0) 0deg,
    rgba(37, 193, 255, 0.6) 180deg,
    #39fff2 340deg,
    rgba(57, 255, 242, 0) 360deg
  );
  -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2.5px));
  mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2.5px));
  animation: bt-loading-spin 0.9s linear infinite;

  @keyframes bt-loading-spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    animation-duration: 2.4s;
  }
`;

const Label = styled.span<{ inline: boolean }>`
  font-size: ${(p) => (p.inline ? '12px' : '13px')};
  letter-spacing: 0.02em;
  margin: ${(p) => (p.inline ? '0 0 0 8px' : '14px 0 0')};
  animation: bt-loading-pulse 1.8s ease-in-out infinite;

  @keyframes bt-loading-pulse {
    0%,
    100% {
      opacity: 0.55;
    }
    50% {
      opacity: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

interface LoadingProps {
  /** Text under (or beside, when inline) the ring. Empty string hides it. */
  label?: React.ReactNode;
  /** Ring size for the block variant; inline always uses the small ring. */
  size?: Size;
  /** Block padding. Defaults: 60px for md, 20px for sm. */
  pad?: string;
  inline?: boolean;
}

export const Loading: React.FC<LoadingProps> = ({ label = 'Loading…', size = 'md', pad, inline = false }) => {
  if (inline) {
    return (
      <Inline role="status" aria-live="polite">
        <Ring px={14} aria-hidden="true" />
        {label !== '' && <Label inline>{label}</Label>}
      </Inline>
    );
  }
  return (
    <Block role="status" aria-live="polite" pad={pad ?? (size === 'sm' ? '20px' : '60px 20px')}>
      <Ring px={RING[size]} aria-hidden="true" />
      {label !== '' && <Label inline={false}>{label}</Label>}
    </Block>
  );
};

export default Loading;
