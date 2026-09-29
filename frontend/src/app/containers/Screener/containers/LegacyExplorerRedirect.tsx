import React from 'react';
import { Navigate, useParams, useSearchParams } from 'react-router-dom';

import { ROUTES } from '@app/shared/constants';
import { CenteredNote } from '../components/CenteredNote';
import { isExplorerNetwork } from './explorer/networks';

// Path shapes of the official explorer (explorer.beam.mw), which the BEAM
// desktop wallet (beam-ui) builds its "Open in Blockchain Explorer" links from:
//
//   {explorer}block?kernel_id=<kernel>   — a transaction's kernel
//   {explorer}assets/details/<aid>       — an asset
//
// and of the older blockex front end those links were first written for:
//
//   {explorer}block/<hash-or-height>[?searched_by=<kernel>]
//   {explorer}contract/<cid>
//
// The wallet picks the explorer host per network (explorer., testnet.explorer.,
// master-net.explorer., dappnet.explorer.), so the network rides in the first
// hostname label. Pointing the wallet at BeamTerminal only needs these paths to
// land on the matching terminal page. index.html has already moved the path and
// query into the hash by the time these render.

// Wallet host labels that name a network BeamTerminal has no explorer node for.
const UNSERVED_NETWORKS: Record<string, string> = {
  testnet: 'testnet',
  'master-net': 'masternet',
};

// Own-property lookup: a label like `constructor` must not hit Object.prototype.
const unservedName = (key: string): string | undefined =>
  Object.prototype.hasOwnProperty.call(UNSERVED_NETWORKS, key) ? UNSERVED_NETWORKS[key] : undefined;

type LegacyNetwork = { network: string } | { unserved: string };

// An explicit `?network=` wins — and one we can't serve says so rather than
// quietly showing mainnet data under another network's link. Otherwise the
// first hostname label names the network, and anything unrecognised
// (explorer., beamterminal.) is mainnet.
function resolveNetwork(param: string | null): LegacyNetwork {
  if (param) {
    if (isExplorerNetwork(param)) return { network: param };
    return { unserved: unservedName(param) ?? param.slice(0, 40) };
  }
  const label = typeof window !== 'undefined' ? window.location.hostname.split('.')[0] : '';
  const unserved = unservedName(label);
  if (unserved) return { unserved };
  return { network: isExplorerNetwork(label) ? label : 'mainnet' };
}

// The node reads a kernel or contract id only when it is exactly 64 hex chars;
// anything else would silently fall back to the chain tip.
const HEX64 = /^[0-9a-f]{64}$/;
const hex64 = (v: string | null | undefined): string | null => {
  const s = (v ?? '').trim().toLowerCase();
  return HEX64.test(s) ? s : null;
};
const digits = (v: string | null | undefined): string | null => {
  const s = (v ?? '').trim();
  return /^\d{1,15}$/.test(s) ? String(Number(s)) : null;
};

function explorerTo(params: Record<string, string>): string {
  return `${ROUTES.NAV.EXPLORER_BEAM}?${new URLSearchParams(params).toString()}`;
}

function Unserved({ network }: { network: string }): JSX.Element {
  return <CenteredNote>Beam Explorer has no explorer node for {network}.</CenteredNote>;
}

/**
 * `/block?kernel_id=<kernel>` (also `?height=<h>`) and the older
 * `/block/<hash-or-height>?searched_by=<kernel>` → the block explorer's block view.
 *
 * The node can look a block up by kernel or height, not by block hash, so a
 * `/block/<hash>` link resolves through its `searched_by` kernel when it has
 * one, and otherwise lands on the status page rather than a wrong block.
 */
export const LegacyBlockRedirect: React.FC = () => {
  const { hash } = useParams<{ hash?: string }>();
  const [searchParams] = useSearchParams();
  const net = resolveNetwork(searchParams.get('network'));
  if ('unserved' in net) return <Unserved network={net.unserved} />;

  const kernel = hex64(searchParams.get('kernel_id')) ?? hex64(searchParams.get('searched_by'));
  const height = digits(searchParams.get('height')) ?? digits(hash);
  if (kernel) return <Navigate to={explorerTo({ network: net.network, type: 'block', kernel })} replace />;
  if (height) return <Navigate to={explorerTo({ network: net.network, type: 'block', height })} replace />;
  return <Navigate to={explorerTo({ network: net.network, type: 'status' })} replace />;
};

/** `/contract/<cid>` → the block explorer's contract view. */
export const LegacyContractRedirect: React.FC = () => {
  const { cid } = useParams<{ cid: string }>();
  const [searchParams] = useSearchParams();
  const net = resolveNetwork(searchParams.get('network'));
  if ('unserved' in net) return <Unserved network={net.unserved} />;

  const id = hex64(cid);
  if (id) return <Navigate to={explorerTo({ network: net.network, type: 'contract', id })} replace />;
  return <Navigate to={explorerTo({ network: net.network, type: 'contracts' })} replace />;
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
