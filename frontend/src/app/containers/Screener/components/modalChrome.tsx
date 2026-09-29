import React, { useEffect, useRef } from 'react';
import { styled } from '@linaria/react';
import { WALLET_DOWNLOADS_URL, WEB_WALLET_URL, type TradeSupport } from '../wallet';

// Shared chrome for modal surfaces across the app: the centered overlay, the
// close button, the four-variant action button, the fee-tier table, and the
// connect/busy/action button-state machine. Keeps the wallet-action modals
// (and every other overlay) visually and behaviourally in lockstep.

/** Escape-key close. `enabled` lets stacked modals encode close precedence —
 *  only the topmost surface should listen. */
export function useEscapeClose(onClose: () => void, enabled = true): void {
  useEffect(() => {
    if (!enabled) return undefined;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, enabled]);
}

export const FEE_TIERS = [
  { kind: 0, label: 'Low · 0.05%' },
  { kind: 1, label: 'Medium · 0.30%' },
  { kind: 2, label: 'High · 1.00%' },
] as const;

export const tierLabel = (kind: number): string => FEE_TIERS.find((t) => t.kind === kind)?.label ?? `kind ${kind}`;

// Fee percent per AMM fee-tier kind (0/1/2 → 0.05% / 0.30% / 1.00%). Canonical
// source so the tier cards, modal subtitles, and detail-page pills agree.
const TIER_FEE_PCT: Record<number, number> = { 0: 0.05, 1: 0.3, 2: 1 };

export const tierFeePct = (kind: number): number => TIER_FEE_PCT[kind] ?? 0;

export const Overlay = styled.div<{ z?: number; backdrop?: string; pad?: string }>`
  position: fixed;
  /* The inset shorthand isn't supported in QtWebEngine 5.15.2 (Chrome 83), the
     BEAM Wallet host — without the longhand the fixed overlay collapses to
     content size and the modal never positions, so it appears not to open. */
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: ${(p) => p.z ?? 1000};
  background: ${(p) => p.backdrop ?? 'rgba(0, 0, 0, 0.6)'};
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${(p) => p.pad ?? '16px'};
`;

export const Card = styled.div`
  width: 100%;
  max-width: 420px;
  background: #042548;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 14px;
  padding: 18px;
  max-height: calc(100vh - 32px);
  overflow-y: auto;
`;

export const CloseBtn = styled.button`
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.5);
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
  padding: 0 4px;
  &:hover {
    color: #fff;
  }
`;

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])';

/**
 * Accessible modal shell for the wallet-action dialogs: the centred overlay +
 * card with role="dialog" / aria-modal and a label, Escape to close, focus moved
 * into the card on open (first field, else the card) and returned to the opener
 * on close, Tab kept inside, and backdrop close only when the press AND the
 * release both landed on the backdrop — so finishing a text-selection drag
 * outside the card doesn't dismiss it.
 */
export const Modal: React.FC<{ label: string; onClose: () => void; children: React.ReactNode }> = ({
  label,
  onClose,
  children,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const pressedBackdrop = useRef(false);
  useEscapeClose(onClose);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const card = cardRef.current;
    const first = card?.querySelector<HTMLElement>('input:not([disabled]), select:not([disabled])');
    (first ?? card)?.focus();
    return () => {
      // Only hand focus back if it is still inside the dialog (or lost to <body>);
      // don't steal it from something the user has since focused.
      const now = document.activeElement;
      if (opener && typeof opener.focus === 'function' && (!now || now === document.body || card?.contains(now))) {
        opener.focus();
      }
    };
  }, []);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (e.key !== 'Tab') return;
    const card = cardRef.current;
    if (!card) return;
    const items = Array.from(card.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (items.length === 0) {
      e.preventDefault();
      return;
    }
    const firstItem = items[0]!;
    const lastItem = items[items.length - 1]!;
    const active = document.activeElement;
    if (e.shiftKey && (active === firstItem || active === card)) {
      e.preventDefault();
      lastItem.focus();
    } else if (!e.shiftKey && active === lastItem) {
      e.preventDefault();
      firstItem.focus();
    }
  };

  return (
    <Overlay
      onMouseDown={(e) => {
        pressedBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        const closes = pressedBackdrop.current && e.target === e.currentTarget;
        pressedBackdrop.current = false;
        if (closes) onClose();
      }}
    >
      <Card ref={cardRef} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} onKeyDown={onKeyDown}>
        {children}
      </Card>
    </Overlay>
  );
};

export type BtnVariant = 'primary' | 'muted' | 'error' | 'success';

export const Btn = styled.button<{ variant: BtnVariant }>`
  width: 100%;
  padding: 12px;
  margin-top: 12px;
  font-size: 14px;
  font-weight: 600;
  border-radius: 10px;
  border: none;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s;
  background: ${(p) =>
    p.variant === 'error'
      ? 'var(--color-red)'
      : p.variant === 'muted'
      ? 'rgba(255, 255, 255, 0.08)'
      : 'var(--color-green)'};
  color: ${(p) =>
    p.variant === 'error' ? 'white' : p.variant === 'muted' ? 'rgba(255, 255, 255, 0.5)' : 'var(--color-dark-blue)'};
  &:hover:not(:disabled) {
    filter: brightness(1.1);
  }
  &:disabled {
    cursor: not-allowed;
    opacity: 0.8;
  }
`;

export interface ActionBtnState {
  text: string;
  variant: BtnVariant;
  disabled: boolean;
}

/**
 * The connect → busy → action button lifecycle shared by the wallet-action
 * modals. Precedence: terminal feedback, then connect (when headless), then the
 * in-flight/disabled reasons, then the live action.
 */
export function actionButtonState(opts: {
  feedback: { kind: 'success' | 'error'; text: string } | null;
  headless: boolean;
  connecting: boolean;
  executing: boolean;
  busyLabel: string;
  /** A muted/disabled reason blocking the action (e.g. "Enter amount"); null if ready. */
  disabledReason?: string | null;
  actionLabel: string;
  /** Connect-button copy; surfaces may name the action ("Connect Wallet to Swap"). */
  connectLabel?: string;
  /** useWallet().support. 'none' (no signing wallet can exist in this browser)
   *  replaces the connect button with a disabled notice. Defaults to connectable. */
  support?: TradeSupport;
}): ActionBtnState {
  const { feedback, headless, connecting, executing, busyLabel, disabledReason, actionLabel } = opts;
  if (feedback?.kind === 'success') return { text: feedback.text, variant: 'success', disabled: true };
  if (feedback?.kind === 'error') return { text: feedback.text, variant: 'error', disabled: true };
  if (headless) {
    if (opts.support === 'none') return { text: 'BEAM wallet required', variant: 'muted', disabled: true };
    return connecting
      ? { text: 'Connecting…', variant: 'muted', disabled: true }
      : { text: opts.connectLabel ?? 'Connect Wallet', variant: 'primary', disabled: false };
  }
  if (executing) return { text: busyLabel, variant: 'muted', disabled: true };
  if (disabledReason) return { text: disabledReason, variant: 'muted', disabled: true };
  return { text: actionLabel, variant: 'primary', disabled: false };
}

const HintBox = styled.div`
  margin-top: 8px;
  font-size: 12px;
  line-height: 1.45;
  color: rgba(255, 255, 255, 0.55);
  text-align: center;
  a {
    color: var(--color-green);
    text-decoration: underline;
  }
`;

/**
 * Explains a disconnected action button on the public web: where no signing
 * wallet can run it links to the wallet downloads, and in Chrome it points at
 * the BEAM Web Wallet extension while a connect is pending or after it failed.
 * Renders nothing once connected, and never inside the BEAM wallet itself.
 */
export const WalletHint: React.FC<{
  headless: boolean;
  support: TradeSupport;
  connecting: boolean;
  connectFailed: boolean;
}> = ({ headless, support, connecting, connectFailed }) => {
  if (!headless || support === 'wallet') return null;
  if (support === 'none') {
    return (
      <HintBox>
        Trading needs the BEAM wallet: open this page from the BEAM desktop wallet, or use desktop Chrome with the BEAM
        Web Wallet extension.{' '}
        <a href={WALLET_DOWNLOADS_URL} target="_blank" rel="noopener noreferrer">
          Get BEAM wallet
        </a>
      </HintBox>
    );
  }
  if (!connecting && !connectFailed) return null;
  return (
    <HintBox>
      {connecting
        ? 'Approve the request in the BEAM Web Wallet extension.'
        : 'No BEAM Web Wallet answered, or the request was rejected.'}{' '}
      <a href={WEB_WALLET_URL} target="_blank" rel="noopener noreferrer">
        Install BEAM Web Wallet
      </a>
    </HintBox>
  );
};
