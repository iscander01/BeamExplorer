import React from 'react';
import { styled } from '@linaria/react';

const Page = styled.div`
  max-width: 760px;
  margin: 0 auto;
  padding: 24px 16px 48px;
  color: rgba(255, 255, 255, 0.85);
  font-family: var(--font-mono);
  font-size: 14px;
  line-height: 1.6;

  h1 {
    font-size: 22px;
    margin: 0 0 8px;
    color: white;
  }
  h2 {
    font-size: 15px;
    margin: 28px 0 8px;
    color: white;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  p {
    margin: 0 0 12px;
  }
  ul {
    margin: 0 0 12px;
    padding-left: 20px;
  }
  li {
    margin: 4px 0;
  }
  a {
    color: #00f6d2;
    text-decoration: none;
  }
  a:hover {
    text-decoration: underline;
  }
  code {
    font-family: var(--font-mono);
    color: #00f6d2;
    background: rgba(0, 246, 210, 0.08);
    padding: 1px 5px;
    border-radius: 3px;
  }
`;

const Updated = styled.div`
  color: rgba(255, 255, 255, 0.45);
  font-size: 12px;
  margin-bottom: 16px;
`;

export const Privacy: React.FC = () => (
  <Page>
    <h1>Privacy Policy</h1>
    <Updated>Last updated: 2026-09-29</Updated>

    <p>
      Beam Explorer (<strong>explorer.beam.mw</strong>) is a block-explorer and DEX analytics front-end for the Beam
      network, based on BeamTerminal. This policy explains what data is processed when you use it.
    </p>

    <h2>What is collected</h2>
    <p>
      <strong>Web-server request logs</strong> — the site is a set of static files served by nginx on Railway. Serving a
      request exposes your IP address, the request time, the requested URL, the HTTP status, the referrer and your
      user-agent to the hosting platform, which may record them in its logs.
    </p>
    <p>
      The site itself has no backend: every data request your browser makes goes to one of the third-party services
      listed below, which see the same kind of request metadata.
    </p>

    <h2>What is not collected</h2>
    <ul>
      <li>No accounts, no sign-up, no email collection.</li>
      <li>No cookies, no advertising pixels, no analytics or tracking scripts.</li>
      <li>
        Your browser&apos;s <code>localStorage</code> holds only UI preferences (such as chart toggles), pair favourites
        and liquidity-position bookmarks; <code>sessionStorage</code> holds one flag that stops an error page from
        reloading in a loop. None of it leaves your device.
      </li>
    </ul>

    <h2>Third parties in the request path</h2>
    <ul>
      <li>
        <strong>Railway</strong> hosts the site. It sees your IP address and request metadata for the page and its
        static files.
      </li>
      <li>
        <strong>BeamTerminal API</strong> — your browser calls <code>https://beamterminal.0xmx.net/api</code> directly
        for DEX, asset, mining, bridge, DAO and DApp data. It is operated by the BeamTerminal maintainer, who therefore
        sees your IP address and request metadata.
      </li>
      <li>
        <strong>Beam explorer nodes</strong> — the BANS, Halving countdown, Supply and Block explorer pages query the
        explorer nodes at <code>explorer.0xmx.net</code> directly from your browser. The Block explorer&apos;s network
        list also includes nodes at <code>BeamSmart.net</code> and <code>explorer-api.beamprivacy.community</code>,
        which it may query too.
      </li>
      <li>
        <strong>Third-party images</strong> — asset logos, DApp icons and images embedded in DAO proposal text can be
        loaded from hosts chosen by the asset issuer, the DApp publisher or the proposal author. Loading them exposes
        your IP address to those hosts.
      </li>
      <li>
        <strong>External links</strong> — clicking links to GitHub, X / Twitter, Telegram, Discord, Etherscan, Arbiscan,
        beam.mw, etc. takes you to those services, which have their own privacy policies.
      </li>
    </ul>

    <h2>How the data is used</h2>
    <p>
      Nothing on this site profiles visitors, sells data or shares it with advertisers. Request logs kept by the
      services above are theirs, under their own policies.
    </p>

    <h2>Data retention</h2>
    <p>
      The site stores nothing about you on its own. How long request logs are kept is up to the hosting platform and
      each third-party service listed above.
    </p>

    <h2>Your rights</h2>
    <p>
      If you are in the EU/EEA you have rights under the GDPR (access, erasure, restriction, etc.). Because the only
      personal data involved is your IP address in request logs, those rights are exercised with whichever service holds
      the logs: the hosting platform, the BeamTerminal API operator or the explorer-node operators.
    </p>

    <h2>Changes to this policy</h2>
    <p>
      This page is updated if the data processed materially changes. The &ldquo;Last updated&rdquo; date at the top of
      the page always reflects the current revision.
    </p>

    <h2>Contact</h2>
    <p>For questions about this site, reach out through the BEAM community channels linked in the site footer.</p>

    <h2>Credits</h2>
    <p>
      This site is a fork of{' '}
      <a href="https://beamterminal.0xmx.net/" target="_blank" rel="noopener noreferrer">
        BeamTerminal
      </a>
      . Its charts use{' '}
      <a href="https://www.tradingview.com/" target="_blank" rel="noopener noreferrer">
        TradingView Lightweight Charts
      </a>
      .
    </p>
    <p>
      TradingView Lightweight Charts&trade;
      <br />
      Copyright (&#x441;) 2023 TradingView, Inc.{' '}
      <a href="https://www.tradingview.com/" target="_blank" rel="noopener noreferrer">
        https://www.tradingview.com/
      </a>
    </p>
  </Page>
);

export default Privacy;
