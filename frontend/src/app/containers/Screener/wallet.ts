// Lightweight wallet-state hook + invoke wrapper used by the SwapPanel.
//
// The connector singleton (`@core/connector`) does NOT auto-connect on page
// load; that only happens when the page is opened inside a BEAM wallet (see
// `shared/store/saga.ts`). In a plain browser the wallet stays disconnected
// until the user explicitly clicks "Connect" via `useWallet().connect()`.

import { useEffect, useState } from 'react';
import connector from '@core/connector';
// eslint-disable-next-line import/no-named-as-default, import/extensions
import BeamDappConnector from '@core/BeamDappConnector.js';
import { ensureConnected, isInsideWallet } from '@core/walletEnv';
import { AddLiquidityApi, CreatePoolApi, LoadPoolsList, TradePoolApi, WithdrawApi } from '@core/api';
import { pairKey } from './components/format';

/** BEAM Web Wallet in the Chrome Web Store (same target as the connector's own
 *  "Install Web Wallet" button). */
export const WEB_WALLET_URL =
  'https://chrome.google.com/webstore/detail/beam-web-wallet/ilhaljfiglknggcoegeknjghdgampffk';
/** Desktop / mobile BEAM wallet downloads, for browsers the extension can't run in. */
export const WALLET_DOWNLOADS_URL = 'https://beam.mw/downloads';

/**
 * How this page can reach a wallet that signs transactions:
 *   'wallet'    - inside the BEAM desktop / mobile wallet (auto-connects).
 *   'extension' - desktop Chrome, via the BEAM Web Wallet extension.
 *   'none'      - anything else. The connector would fall back to its key-less
 *                 headless WASM client there, which can read but never sign, so
 *                 trading is not offered at all.
 */
export type TradeSupport = 'wallet' | 'extension' | 'none';

function tradeSupport(): TradeSupport {
  if (isInsideWallet()) return 'wallet';
  // A phone/tablet browser outside the BEAM app can't run the Web Wallet
  // extension, and the connector would only fall back to its key-less client.
  if (BeamDappConnector.isMobile()) return 'none';
  // Mirrors the connector's WEB branch: it only tries the extension on desktop
  // Chrome (not Edge) and goes headless everywhere else.
  if (BeamDappConnector.isWeb() && BeamDappConnector.isChrome()) return 'extension';
  return 'none';
}

/** Connected to a wallet that can sign. A headless (WASM) connection is
 *  read-only, so it doesn't count. */
function hasSigner(): boolean {
  return connector.isConnected() && connector.getEnvironment() !== 'headless';
}

interface WalletState {
  /** True when no signing wallet is connected (the key-less headless client
   *  counts as not connected). */
  headless: boolean;
  /** True when running inside the BEAM wallet's webview. */
  inWallet: boolean;
  /** Whether a signing wallet is reachable from this browser at all. */
  support: TradeSupport;
  /** True while a connect attempt is in flight. */
  connecting: boolean;
  /** The last on-demand connect attempt failed (e.g. Chrome without the
   *  extension, or the user rejected it). Cleared by the next attempt. */
  connectFailed: boolean;
}

// Module-level store shared by every `useWallet` instance. The connector is a
// singleton, so its state is global: one poller watches it and every mounted
// hook is notified on change, rather than each instance polling on its own.
let cached: WalletState = {
  headless: true,
  inWallet: isInsideWallet(),
  support: tradeSupport(),
  connecting: false,
  connectFailed: false,
};

type Listener = () => void;
const listeners = new Set<Listener>();
let pollTimer: ReturnType<typeof setInterval> | null = null;

function snapshot(connecting: boolean, connectFailed: boolean): WalletState {
  return {
    headless: !hasSigner(),
    inWallet: isInsideWallet(),
    support: tradeSupport(),
    connecting,
    connectFailed,
  };
}

/** Re-read the connector and notify subscribers when any field changed. */
function refresh(connecting = cached.connecting, connectFailed = cached.connectFailed): void {
  const next = snapshot(connecting, connectFailed);
  if (
    next.headless === cached.headless &&
    next.inWallet === cached.inWallet &&
    next.support === cached.support &&
    next.connecting === cached.connecting &&
    next.connectFailed === cached.connectFailed
  ) {
    return;
  }
  cached = next;
  listeners.forEach((l) => l());
}

/** Register a change listener. The shared poller starts with the first
 *  subscriber and stops with the last, so nothing ticks while no wallet-aware
 *  surface is mounted. Hidden tabs skip the tick. */
function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  if (listeners.size === 1) {
    refresh();
    pollTimer = setInterval(() => {
      if (document.hidden) return;
      refresh();
    }, 3000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && pollTimer !== null) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  };
}

/** Ask the wallet to connect. `connecting` is shared state, so every mounted
 *  hook shows the in-flight status, not only the one whose button was pressed.
 *  Resolves false without trying where no signing wallet can exist, so the
 *  key-less headless client is never started for trading. */
async function connect(): Promise<boolean> {
  if (hasSigner()) return true;
  if (tradeSupport() === 'none') return false;
  // Outside the wallet every connect is on demand (a button press): one
  // attempt, no background retry loop. Without the extension the connector's
  // default auto-reconnect would re-post the request up to 10 times, each one
  // waiting out its 30s timeout. In-wallet reconnects are left as they are.
  if (!isInsideWallet()) connector.config.autoReconnect = false;
  refresh(true, false);
  let ok = false;
  try {
    ok = (await ensureConnected()) && hasSigner();
    return ok;
  } finally {
    refresh(false, !ok);
  }
}

/** Connect on demand, or throw when no signing wallet is available. */
async function requireSigner(): Promise<void> {
  const ok = await connect();
  if (!ok) throw new Error('Wallet not connected');
}

export function useWallet(): WalletState & { connect: () => Promise<boolean> } {
  const [state, setState] = useState<WalletState>(() => snapshot(cached.connecting, cached.connectFailed));

  useEffect(() => {
    const unsubscribe = subscribe(() => setState(cached));
    // Sync to the store's current snapshot: `subscribe` only re-reads the
    // connector for the first subscriber, and it may have changed between this
    // instance's render and its mount.
    refresh();
    setState(cached);
    return unsubscribe;
  }, []);

  return { ...state, connect };
}

// Shape of a row from the AMM `pools_view` shader. The contract stamps
// `creator: 1` only on pools the calling wallet created (contract-side
// IsCreator), which is what the "MY" filter keys off.
interface ShaderPool {
  aid1: number;
  aid2: number;
  kind: number;
  creator?: number;
}

/**
 * Pair keys ("<aid1>_<aid2>") of pools the connected wallet created, for the
 * DEX page's "MY" filter. Only fetches while `enabled` (the MY filter is
 * active) and a wallet is connected — so it never polls the shader on the
 * public web, nor in the background when the user isn't looking at MY.
 * Refreshes on the same 30s cadence as the pairs list while active.
 */
export function useMyCreatedPairs(enabled: boolean): { createdKeys: Set<string>; loading: boolean } {
  const { headless } = useWallet();
  const [createdKeys, setCreatedKeys] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setCreatedKeys(new Set());
      return undefined;
    }
    // Fetch as soon as MY is selected. When not yet connected the shader call
    // fails gracefully (empty set); `headless` is a dep, so the effect re-runs
    // and re-fetches the moment a connection is established — no 3s poll lag.
    let cancelled = false;
    const fetchPools = async (): Promise<void> => {
      setLoading(true);
      try {
        const pools = (await LoadPoolsList<ShaderPool[]>()) || [];
        if (cancelled) return;
        const keys = new Set<string>();
        for (const p of pools) {
          if (p && p.creator) keys.add(pairKey(p.aid1, p.aid2));
        }
        setCreatedKeys(keys);
      } catch {
        if (!cancelled) setCreatedKeys(new Set());
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void fetchPools();
    const t = setInterval(() => {
      if (document.hidden) return;
      void fetchPools();
    }, 30_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [headless, enabled]);

  return { createdKeys, loading };
}

export interface TradeArgs {
  aid1: number; // canonical lower-AID side of the pool
  aid2: number;
  kind: 0 | 1 | 2;
  val1_buy: number; // groths of aid1 the user wants to receive (0 if direction is reversed)
  // Groths of aid2 the user is willing to pay; an exact string (format.toGrothsStr)
  // for real trades so large amounts keep full precision.
  val2_pay: number | string;
  bPredictOnly: 0 | 1;
}

export interface TradeResult {
  // Predict-only fields (echoed from the shader):
  buy?: number;
  pay?: number;
  fee?: number;
  // Execute fields:
  txid?: string;
  // Anything else the shader returns:
  [k: string]: unknown;
}

export async function invokeTrade(args: TradeArgs): Promise<TradeResult> {
  // Ensure a signing wallet is connected before invoking. No-op when already connected.
  await requireSigner();
  return TradePoolApi<TradeResult>(args);
}

export interface AddLiquidityArgs {
  aid1: number; // canonical lower-AID side of the pool
  aid2: number;
  kind: 0 | 1 | 2;
  // Groth amounts as exact strings (format.toGrothsStr) so large deposits keep
  // full precision; '0' lets the contract derive that side.
  val1: number | string;
  val2: number | string;
  bPredictOnly: 0 | 1;
}

export interface WithdrawArgs {
  aid1: number;
  aid2: number;
  kind: 0 | 1 | 2;
  ctl: number | string; // groths of the pool's LP token to burn (exact string)
  bPredictOnly: 0 | 1;
}

// Shared shape for add/withdraw. Predict (bPredictOnly=1) echoes the shader's
// `res` ({ tok1, tok2, ctl } in groths); execute (bPredictOnly=0) returns txid.
export interface LiquidityResult {
  res?: { tok1?: number; tok2?: number; ctl?: number };
  txid?: string;
  [k: string]: unknown;
}

export async function invokeAddLiquidity(args: AddLiquidityArgs): Promise<LiquidityResult> {
  await requireSigner();
  return AddLiquidityApi<LiquidityResult>(args);
}

export async function invokeWithdraw(args: WithdrawArgs): Promise<LiquidityResult> {
  await requireSigner();
  return WithdrawApi<LiquidityResult>(args);
}

export interface CreatePoolArgs {
  aid1: number; // must be < aid2 (the contract pool-key invariant)
  aid2: number;
  kind: 0 | 1 | 2;
}

// Registers an empty pool for (aid1, aid2, kind). It must then be seeded via
// Add Liquidity. CreatePoolApi takes a single-element array.
export async function invokeCreatePool(args: CreatePoolArgs): Promise<{ txid?: string }> {
  await requireSigner();
  return CreatePoolApi<{ txid?: string }>([args]);
}
