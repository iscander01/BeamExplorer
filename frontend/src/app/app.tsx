import React, { useEffect } from 'react';

import 'react-toastify/dist/ReactToastify.css';

import { Navigate, useLocation, useRoutes } from 'react-router-dom';
import { useSelector } from 'react-redux';

import { ToastContainer } from 'react-toastify';

import './styles';
// Landing surfaces plus the thin layout shells stay in the entry chunk; every
// other page is a lazy route chunk. Direct file imports (not the Screener
// barrel) so webpack can split them — the barrel would pull everything into
// the entry, as no sideEffects config exists to shake it.
import { PairsList } from '@app/containers/Screener/containers/PairsList';
import { AssetsList } from '@app/containers/Screener/containers/AssetsList';
import { ExplorerLayout } from '@app/containers/Screener/containers/ExplorerLayout';
import { DaoLayout } from '@app/containers/Screener/containers/DaoLayout';
import { Footer } from '@app/containers/Screener/components/Footer';
import { AssetColorsProvider } from '@app/containers/Screener/assetColors';
import { ROUTES } from '@app/shared/constants';
import { Loader, TopNav } from '@app/shared/components';
import ErrorBoundary from '@app/shared/components/ErrorBoundary';
import BeamDappConnector from '@core/BeamDappConnector.js';
import { selectIsLoaded } from '@app/shared/store/selectors';

const PairDetail = React.lazy(() =>
  import('@app/containers/Screener/containers/PairDetail').then((m) => ({ default: m.PairDetail })),
);
const LiquidityPosition = React.lazy(() =>
  import('@app/containers/Screener/containers/LiquidityPosition/LiquidityPosition').then((m) => ({
    default: m.LiquidityPosition,
  })),
);
const AssetDetail = React.lazy(() =>
  import('@app/containers/Screener/containers/AssetDetail').then((m) => ({ default: m.AssetDetail })),
);
const NetworkCharts = React.lazy(() =>
  import('@app/containers/Screener/containers/NetworkCharts').then((m) => ({ default: m.NetworkCharts })),
);
const Countdown = React.lazy(() =>
  import('@app/containers/Screener/containers/explorer/Countdown').then((m) => ({ default: m.Countdown })),
);
const Supply = React.lazy(() =>
  import('@app/containers/Screener/containers/explorer/Supply').then((m) => ({ default: m.Supply })),
);
const BANS = React.lazy(() =>
  import('@app/containers/Screener/containers/explorer/BANS').then((m) => ({ default: m.BANS })),
);
const BridgeTracker = React.lazy(() =>
  import('@app/containers/Screener/containers/explorer/BridgeTracker').then((m) => ({ default: m.BridgeTracker })),
);
const Mining = React.lazy(() =>
  import('@app/containers/Screener/containers/explorer/Mining').then((m) => ({ default: m.Mining })),
);
const Oracle = React.lazy(() =>
  import('@app/containers/Screener/containers/explorer/Oracle').then((m) => ({ default: m.Oracle })),
);
const BeamExplorer = React.lazy(() =>
  import('@app/containers/Screener/containers/explorer/BeamExplorer').then((m) => ({ default: m.BeamExplorer })),
);
const AtomicSwaps = React.lazy(() =>
  import('@app/containers/Screener/containers/explorer/AtomicSwaps').then((m) => ({ default: m.AtomicSwaps })),
);
const AssetSwaps = React.lazy(() =>
  import('@app/containers/Screener/containers/explorer/AssetSwaps').then((m) => ({ default: m.AssetSwaps })),
);
const Dapps = React.lazy(() =>
  import('@app/containers/Screener/containers/explorer/Dapps').then((m) => ({ default: m.Dapps })),
);
const Privacy = React.lazy(() =>
  import('@app/containers/Screener/containers/Privacy').then((m) => ({ default: m.Privacy })),
);
const DaoOverview = React.lazy(() =>
  import('@app/containers/Screener/containers/explorer/dao/DaoOverview').then((m) => ({ default: m.DaoOverview })),
);
const DaoTreasury = React.lazy(() =>
  import('@app/containers/Screener/containers/explorer/dao/DaoTreasury').then((m) => ({ default: m.DaoTreasury })),
);
const DaoRevenue = React.lazy(() =>
  import('@app/containers/Screener/containers/explorer/dao/DaoRevenue').then((m) => ({ default: m.DaoRevenue })),
);
const DaoGovernance = React.lazy(() =>
  import('@app/containers/Screener/containers/explorer/dao/DaoGovernance').then((m) => ({ default: m.DaoGovernance })),
);
const DaoProposal = React.lazy(() =>
  import('@app/containers/Screener/containers/explorer/dao/DaoProposal').then((m) => ({ default: m.DaoProposal })),
);

const routes = [
  { path: '*', element: <Navigate to={ROUTES.NAV.DEX} replace /> },
  { path: ROUTES.NAV.DEX, element: <PairsList /> },
  { path: ROUTES.NAV.LIQUIDITY, element: <LiquidityPosition /> },
  { path: ROUTES.NAV.PAIR_DETAIL, element: <PairDetail /> },
  { path: ROUTES.NAV.ASSETS, element: <AssetsList /> },
  { path: ROUTES.NAV.ASSET_INFO, element: <AssetDetail /> },
  { path: ROUTES.NAV.ATOMIC_SWAPS, element: <AtomicSwaps /> },
  { path: ROUTES.NAV.ASSET_SWAPS, element: <AssetSwaps /> },
  { path: ROUTES.NAV.DAPPS, element: <Dapps /> },
  { path: ROUTES.NAV.PRIVACY, element: <Privacy /> },
  {
    path: ROUTES.NAV.EXPLORER,
    element: <ExplorerLayout />,
    children: [
      { index: true, element: <Navigate to={ROUTES.NAV.EXPLORER_CHARTS} replace /> },
      { path: 'charts', element: <NetworkCharts /> },
      { path: 'beam', element: <BeamExplorer /> },
      { path: 'bans', element: <BANS /> },
      { path: 'countdown', element: <Countdown /> },
      { path: 'supply', element: <Supply /> },
      { path: 'bridge', element: <BridgeTracker /> },
      { path: 'mining', element: <Mining /> },
      { path: 'oracle', element: <Oracle /> },
      {
        path: 'dao',
        element: <DaoLayout />,
        children: [
          { index: true, element: <DaoOverview /> },
          { path: 'treasury', element: <DaoTreasury /> },
          { path: 'revenue', element: <DaoRevenue /> },
          { path: 'governance', element: <DaoGovernance /> },
          { path: 'governance/proposal/:id', element: <DaoProposal /> },
        ],
      },
    ],
  },
];

const App = () => {
  const content = useRoutes(routes);
  const isLoaded = useSelector(selectIsLoaded());
  const isWeb = BeamDappConnector.isWeb();
  const { pathname } = useLocation();

  // Land every route at the top: the document keeps its scroll offset while
  // the route content underneath it swaps.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  useEffect(() => {
    // Activates the host-specific shell rules in styles.ts: `body.web` /
    // `body.mobile` paint the dark-blue page background, while `html.desktop`
    // clears the dark first-paint background inlined in index.html so the
    // desktop wallet can supply its own backdrop.
    const cls = BeamDappConnector.isMobile() ? 'mobile' : isWeb ? 'web' : 'desktop';
    document.body.classList.add(cls);
    document.documentElement.classList.add(cls);
    return () => {
      document.body.classList.remove(cls);
      document.documentElement.classList.remove(cls);
    };
  }, [isWeb]);

  return (
    <>
      {isLoaded ? (
        <>
          <TopNav />
          <AssetColorsProvider>
            <ErrorBoundary>
              <React.Suspense
                fallback={
                  <div style={{ textAlign: 'center', padding: '60px 20px', color: 'rgba(255, 255, 255, 0.5)' }}>
                    Loading…
                  </div>
                }
              >
                {content}
              </React.Suspense>
            </ErrorBoundary>
          </AssetColorsProvider>
          <Footer />
          <ToastContainer
            position="bottom-right"
            autoClose={3000}
            hideProgressBar
            newestOnTop={false}
            closeOnClick
            closeButton={false}
            rtl={false}
            pauseOnFocusLoss={false}
            draggable={false}
            pauseOnHover={false}
            icon={false}
            toastStyle={{
              textAlign: 'center',
              background: '#22536C',
              color: 'white',
              width: '90%',
              margin: '0 auto 36px',
              borderRadius: '10px',
            }}
          />
        </>
      ) : (
        <Loader />
      )}
    </>
  );
};

export default App;
