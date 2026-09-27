import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import { HashRouter } from 'react-router-dom';

import configureStore from '@app/store/store';
import App from './app';

if (process.env.NODE_ENV === 'development') {
  // eslint-disable-next-line import/no-extraneous-dependencies -- dev-only tool, stripped from prod builds
  import('react-grab').then((m) =>
    m.init({ activationMode: 'toggle', allowActivationInsideInput: false, maxContextLines: 3 }),
  );
}

const { store } = configureStore();

window.global = window;

export default store;

ReactDOM.render(
  <HashRouter>
    <Provider store={store}>
      <App />
    </Provider>
  </HashRouter>,
  document.getElementById('root'),
);
