import React from 'react';
import { styled } from '@linaria/react';
import { api } from '../api/client';
import { usePolled } from '../hooks';

interface HealthResp {
  status: string;
  last_indexed_height: number;
  chain_head: number | null;
  blocks_behind: number | null;
  lag_seconds: number;
}

const Wrap = styled.footer`
  width: 100%;
  margin-top: 48px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(4, 37, 72, 0.4);
`;

const Inner = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 28px 16px 20px;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  grid-gap: 24px;

  @media (max-width: 800px) {
    grid-template-columns: 1fr 1fr;
  }
`;

const Col = styled.div`
  display: flex;
  flex-direction: column;
  & > * + * {
    margin-top: 6px;
  }
`;

const ColTitle = styled.div`
  font-family: var(--font-mono);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(255, 255, 255, 0.4);
  margin-bottom: 2px;
`;

const FLink = styled.a`
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
  text-decoration: none;
  transition: color 120ms;

  &:hover {
    color: #00f6d2;
  }
`;

// Community links as a row of icon buttons. Plain margins, not flex gap (the
// wallet's Chrome 83 predates it).
const IconRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  & > * {
    margin: 0 10px 6px 0;
  }
`;

const IconLink = styled.a`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.7);
  transition: color 120ms, border-color 120ms;

  svg {
    width: 18px;
    height: 18px;
    fill: currentColor;
  }

  &:hover {
    color: #00f6d2;
    border-color: rgba(0, 246, 210, 0.5);
  }
`;

// Brand glyphs from Simple Icons (CC0), 24×24.
const COMMUNITY = [
  {
    label: 'X (Twitter)',
    href: 'https://x.com/beamprivacy',
    path: 'M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z',
  },
  {
    label: 'Telegram',
    href: 'https://t.me/beamprivacy',
    path: 'M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z',
  },
  {
    label: 'Discord',
    href: 'https://discord.gg/fwfArUqpfh',
    path: 'M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.865-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z',
  },
];

// Inline link in the bottom bar: same muted tone as the text around it,
// accent on hover like the column links.
const BottomLink = styled.a`
  color: rgba(255, 255, 255, 0.7);
  text-decoration: none;
  transition: color 120ms;

  &:hover {
    color: #00f6d2;
  }
`;

const BottomBar = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 12px 16px 18px;
  border-top: 1px solid rgba(255, 255, 255, 0.04);
  display: flex;
  justify-content: space-between;
  align-items: center;
  & > * + * {
    margin-left: 12px;
  }
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  flex-wrap: wrap;
`;

const Badge = styled.span<{ tone: 'ok' | 'lag' | 'err' }>`
  display: inline-flex;
  align-items: center;
  padding: 4px 9px;
  border-radius: 999px;
  font-family: var(--font-mono);
  font-size: 11px;
  color: ${(p) => (p.tone === 'ok' ? '#00f6d2' : p.tone === 'lag' ? '#f0c14b' : '#ff7676')};
  border: 1px solid
    ${(p) =>
      p.tone === 'ok'
        ? 'rgba(0, 246, 210, 0.4)'
        : p.tone === 'lag'
        ? 'rgba(240, 193, 75, 0.5)'
        : 'rgba(255, 118, 118, 0.5)'};
  background: rgba(0, 0, 0, 0.18);
`;

const BadgeDot = styled.span`
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
  box-shadow: 0 0 6px currentColor;
  /* Match the 9px side padding so the orb has equal breathing room to the
     label and to the rounded pill border. (Plain margin, not flex gap — the
     wallet's QtWebEngine/Chrome 83 predates flex gap support.) */
  margin-right: 9px;
`;

const IndexerBadge: React.FC = () => {
  const { data: health, error } = usePolled<HealthResp>(() => api.health(), [], 30_000);

  if (error !== null && !health) {
    return (
      <Badge tone="err">
        <BadgeDot />
        indexer · unreachable
      </Badge>
    );
  }
  if (!health) {
    return (
      <Badge tone="ok">
        <BadgeDot />
        syncing…
      </Badge>
    );
  }

  const behind = health.blocks_behind ?? 0;
  const lagSec = health.lag_seconds ?? 0;
  const tone: 'ok' | 'lag' | 'err' = lagSec > 300 ? 'lag' : behind > 5 ? 'lag' : 'ok';
  const label =
    behind > 0
      ? `syncing · ${behind.toLocaleString()} block${behind === 1 ? '' : 's'} behind`
      : `synced · ${health.last_indexed_height.toLocaleString()}`;

  return (
    <Badge tone={tone} title={`tick ${lagSec}s ago · chain head ${health.chain_head?.toLocaleString() ?? '?'}`}>
      <BadgeDot />
      {label}
    </Badge>
  );
};

export const Footer: React.FC = () => (
  <Wrap>
    <Inner>
      <Col>
        <ColTitle>BEAM</ColTitle>
        <FLink href="https://beam.mw" target="_blank" rel="noopener noreferrer">
          beam.mw
        </FLink>
      </Col>
      <Col>
        <ColTitle>Community</ColTitle>
        <IconRow>
          {COMMUNITY.map((c) => (
            <IconLink
              key={c.label}
              href={c.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={c.label}
              title={c.label}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d={c.path} />
              </svg>
            </IconLink>
          ))}
        </IconRow>
      </Col>
    </Inner>
    <BottomBar>
      <span>
        Built on{' '}
        <BottomLink href="https://beamterminal.0xmx.net/" target="_blank" rel="noopener noreferrer">
          BeamTerminal
        </BottomLink>
      </span>
      <IndexerBadge />
    </BottomBar>
  </Wrap>
);

export default Footer;
