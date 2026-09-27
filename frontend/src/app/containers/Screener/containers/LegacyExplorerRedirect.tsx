import React from 'react';
import { Navigate, useParams, useSearchParams } from 'react-router-dom';

import { ROUTES } from '@app/shared/constants';
import { CenteredNote } from '../components/CenteredNote';
import { explorerNodes } from './explorer/networks';

// Path shapes of the official explorer (explorer.beam.mw), which the BEAM
// desktop wallet (beam-ui) builds its "Open in Blockchain Explorer" links from:
//
//   {explorer}block?kernel_id=<kernel>   — a transaction's kernel
//   {explorer}assets/details/<aid>       — an asset
//
// The wallet picks the explorer host per network (explorer., testnet.explorer.,
// master-net.explorer., dappnet.explorer.), so the network rides in the first
// hostname label. Pointing the wallet at BeamTerminal only needs these paths to
// land on the matching terminal page. index.html has already moved the path into
// the hash by the time these render.

// Wallet host labels that name a network BeamTerminal has no explorer node for.
const UNSERVED_NETWORKS: Record<string, string> = {
  testnet: 'testnet',
  'master-net': 'masternet',
};

type LegacyNetwork = { network: string } | { unserved: string };

// An explicit `?network=` wins; otherwise the first hostname label names the
// network, and anything unrecognised (explorer., beamterminal.) is mainnet.
function resolveNetwork(param: string | null): LegacyNetwork {
  if (param && explorerNodes[param]) return { network: param };
  const label = typeof window !== 'undefined' ? window.location.hostname.split('.')[0] : '';
  if (UNSERVED_NETWORKS[label]) return { unserved: UNSERVED_NETWORKS[label] };
  return { network: explorerNodes[label] ? label : 'mainnet' };
}

function explorerTo(params: Record<string, string>): string {
  return `${ROUTES.NAV.EXPLORER_BEAM}?${new URLSearchParams(params).toString()}`;
}

function Unserved({ network }: { network: string }): JSX.Element {
  return <CenteredNote>Beam Explorer has no explorer node for {network}.</CenteredNote>;
}

/** `/block?kernel_id=<kernel>` (also `?height=<h>`) → the block explorer's block view. */
export const LegacyBlockRedirect: React.FC = () => {
  const [searchParams] = useSearchParams();
  const net = resolveNetwork(searchParams.get('network'));
  if ('unserved' in net) return <Unserved network={net.unserved} />;

  const kernel = searchParams.get('kernel_id')?.trim();
  const height = searchParams.get('height')?.trim();
  if (kernel) return <Navigate to={explorerTo({ network: net.network, type: 'block', kernel })} replace />;
  if (height) return <Navigate to={explorerTo({ network: net.network, type: 'block', height })} replace />;
  return <Navigate to={explorerTo({ network: net.network, type: 'status' })} replace />;
};

/** `/assets/details/<aid>` → the asset page on mainnet, the explorer's asset view elsewhere. */
export const LegacyAssetRedirect: React.FC = () => {
  const { id = '' } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const net = resolveNetwork(searchParams.get('network'));
  if ('unserved' in net) return <Unserved network={net.unserved} />;

  if (!/^\d+$/.test(id)) return <Navigate to={ROUTES.NAV.ASSETS} replace />;
  // The terminal's own asset page reads the indexer, which only follows mainnet.
  if (net.network === 'mainnet') return <Navigate to={ROUTES.NAV.ASSET_INFO.replace(':id', id)} replace />;
  return <Navigate to={explorerTo({ network: net.network, type: 'asset', id })} replace />;
};
