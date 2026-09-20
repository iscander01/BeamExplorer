import { call } from 'redux-saga/effects';

import { setIsLoaded } from '@app/shared/store/actions';
import { actions as mainActions } from '@app/containers/Pools/store/index';

import connector from '@core/connector';
import { isInsideWallet } from '@core/walletEnv';
import store from '../../../index';

export async function start() {
  store.dispatch(mainActions.loadAppParams.request());
}

function init() {
  // Render the screener immediately. Wallet-dependent flows (pools, swaps)
  // initialize their own data once a connection exists.
  // Deferred to a microtask: this runs synchronously inside configureStore(),
  // before index.tsx's `export default store` is assigned, so a synchronous
  // access would hit a TDZ on the entry's default export.
  queueMicrotask(() => store.dispatch(setIsLoaded(true)));

  // Auto-connect only when the page is loaded inside a BEAM wallet
  // (desktop Qt WebEngine, mobile WebView with window.BEAM, etc.). In a
  // plain browser the wallet stays disconnected until the user triggers a
  // wallet-requiring action.
  if (isInsideWallet()) {
    connector
      .connect()
      .then(() => start())
      .catch(() => {});
  }
}

function* sharedSaga() {
  yield call(init);
}

export default sharedSaga;
