// Explorer node config, shared by the block explorer page and the legacy
// explorer.beam.mw redirects (LegacyExplorerRedirect). Kept out of
// BeamExplorer.tsx so the redirects, which live in the entry chunk, can read
// the network list without pulling in the lazy explorer chunk.

export interface NetworkConfig {
  type: 'PoW' | 'PoS';
  description: string;
  url: string[];
}

export const explorerNodes: Record<string, NetworkConfig> = {
  mainnet: {
    type: 'PoW',
    description: 'PoW, ~1-min blocks',
    url: [
      'https://explorer.0xmx.net/api/mainnet/',
      'https://BeamSmart.net:8000/',
      'https://explorer-api.beamprivacy.community/',
    ],
  },
  dappnet: {
    type: 'PoW',
    description: 'FakePoW, ~15-sec blocks',
    url: ['https://BeamSmart.net:8001/'],
  },
  dappnet2: {
    type: 'PoS',
    description: 'PoS, ~15-sec blocks',
    url: ['https://explorer.0xmx.net/api/dappnet2/', 'https://BeamSmart.net:8002/'],
  },
  warp_dev3: {
    type: 'PoS',
    description: 'PoS, ~15-sec blocks',
    url: ['https://explorer.0xmx.net/api/warp_dev3/'],
  },
};

/**
 * True when `name` is a network we have an explorer node for. An own-property
 * check, not `explorerNodes[name]`: a `?network=constructor` or `__proto__`
 * would otherwise resolve to an Object.prototype member and get past a
 * truthiness test.
 */
export function isExplorerNetwork(name: string | null | undefined): boolean {
  return !!name && Object.prototype.hasOwnProperty.call(explorerNodes, name);
}
