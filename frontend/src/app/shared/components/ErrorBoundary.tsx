import React from 'react';
import { styled } from '@linaria/react';
import { ErrorSvg } from '@app/shared/icons';

interface Props {
  /** Clears a caught error when it changes — pass the route path, so one broken
   *  page doesn't keep the fallback up after the user navigates elsewhere. */
  resetKey?: string;
  children?: React.ReactNode;
}

interface State {
  hasError: boolean;
  chunkError: boolean;
}

// A deploy replaces every content-hashed chunk, so a tab opened before it asks
// for chunk files that no longer exist. webpack rejects the lazy import with a
// ChunkLoadError ("Loading chunk 123 failed."); mini-css-extract with
// CSS_CHUNK_LOAD_FAILED ("Loading CSS chunk 123 failed.").
function isChunkLoadError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { name?: unknown; code?: unknown; message?: unknown };
  if (e.name === 'ChunkLoadError' || e.code === 'CSS_CHUNK_LOAD_FAILED') return true;
  return typeof e.message === 'string' && /Loading (CSS )?chunk \S+ failed/.test(e.message);
}

// A reload fetches the new index.html and its chunks. Allowed once per window:
// if the chunk is still missing right after a reload, the deploy itself is
// broken and another reload would only loop. Without sessionStorage (blocked
// storage) there's no way to tell, so don't reload at all.
const RELOAD_KEY = 'chunkErrorReloadAt';
const RELOAD_WINDOW_MS = 60_000;

function reloadOnce(): boolean {
  try {
    const last = Number(window.sessionStorage.getItem(RELOAD_KEY));
    const now = Date.now();
    if (last && now - last < RELOAD_WINDOW_MS) return false;
    window.sessionStorage.setItem(RELOAD_KEY, String(now));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

const ErrorWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin-top: 150px;
  padding: 0 20px;
  text-align: center;
  > svg {
    width: 150px;
    height: 150px;
    margin-bottom: 25px;
  }
  > h2 {
    margin-top: 0;
    font-size: 16px;
    color: rgba(255, 255, 255, 0.6);
  }
`;

const ReloadButton = styled.button`
  margin-top: 8px;
  padding: 10px 22px;
  border: 1px solid var(--color-green);
  border-radius: 10px;
  background: transparent;
  color: var(--color-green);
  font: inherit;
  cursor: pointer;

  &:hover {
    background: rgba(0, 246, 210, 0.1);
  }
`;

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, chunkError: false };
  }

  static getDerivedStateFromError(error: unknown): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, chunkError: isChunkLoadError(error) };
  }

  componentDidUpdate(prevProps: Props): void {
    const { resetKey } = this.props;
    const { hasError } = this.state;
    if (hasError && prevProps.resetKey !== resetKey) {
      // eslint-disable-next-line react/no-did-update-set-state -- reset on a prop change, the documented pattern
      this.setState({ hasError: false, chunkError: false });
    }
  }

  componentDidCatch(error: unknown, errorInfo: React.ErrorInfo): void {
    if (isChunkLoadError(error) && reloadOnce()) return;
    // You can also log the error to an error reporting service
    // eslint-disable-next-line no-console
    console.error(error, errorInfo);
  }

  render() {
    const { hasError, chunkError } = this.state;
    if (hasError) {
      // A plain page reload is right for both hosts: the website and the
      // wallet's DApp view each reload the bundle they serve.
      return (
        <ErrorWrapper>
          <ErrorSvg />
          <h1>{chunkError ? 'Beam Explorer was updated.' : 'Something went wrong.'}</h1>
          <h2>
            {chunkError ? 'Reload the page to load the latest version.' : 'Reload the page, or open another section.'}
          </h2>
          <ReloadButton type="button" onClick={() => window.location.reload()}>
            Reload
          </ReloadButton>
        </ErrorWrapper>
      );
    }

    const { children } = this.props;

    return children;
  }
}
