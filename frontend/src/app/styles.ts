import { css } from '@linaria/core';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions
css`
  :global() {
    :root {
      --color-purple: #da68f5;
      --color-red: #f25f5b;
      --color-red-expiring: #ff436a;
      --color-yellow: #f4ce4a;
      --color-green: #00f6d2;
      --color-blue: #0bccf7;
      --color-dark-blue: #042548;
      --color-darkest-blue: #032e49;
      --color-white: #ffffff;
      --color-gray: #8196a4;
      //--color-white: white;
      --color-disabled: #8da1ad;
      --color-select-list: rgba(0, 0, 0, 0.8);
      --color-opasity-0-1: rgba(255, 255, 255, 0.1);

      /*
       * BEAM brand palette + page gradient, from the Beam Explorer "front"
       * theme (the original explorer's look). Stops match the logo in TopNav.
       */
      --color-beam-sky: #25c1ff;
      --color-beam-blue: #0b76ff;
      --color-beam-cyan: #39fff2;
      --color-beam-green: #00e2c2;
      --color-beam-pink: #fe52ff;
      --color-beam-purple: #ab37e6;
      --gradient-beam: linear-gradient(135deg, #0b76ff 0%, #39fff2 100%);
      --gradient-page: linear-gradient(180deg, #032e49, #0073a6),
        radial-gradient(circle at 50% 0, rgba(255, 255, 255, 0.5), rgba(0, 0, 0, 0.5)),
        linear-gradient(to left, rgba(255, 255, 255, 0.5), #d33b65),
        linear-gradient(297deg, #156fc3, rgba(255, 255, 255, 0.5)),
        radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0), rgba(21, 6, 40, 0.12));

      /*
       * Typography — deliberate system-font stacks; no webfonts are shipped.
       * --font-mono carries the terminal look of the data surfaces (tables,
       * numerals, hashes). ui-monospace is unknown to the wallet's QtWebEngine
       * 5.15 (Chrome 83) and is safely skipped there; the stack then falls
       * through to SF Mono / Menlo / Consolas per platform.
       */
      --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial,
        sans-serif;
      --font-mono: ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Consolas, 'Liberation Mono',
        'DejaVu Sans Mono', monospace;

      /*
       * Spacing: fluid page gutter + stepped pool tokens.
       * Primary narrow breakpoint for pool spacing is 1080px (matches EmbeddedLayout column stack).
       * Legacy 913px remains for some grid/column switches only.
       */
      --page-padding-x: clamp(12px, 2.2vw + 8px, 20px);

      --pool-card-padding: 16px;
      --pool-block-padding: 12px;
      --pool-block-margin-bottom: 10px;
      --pool-grid-gap: 20px;
      --pool-embedded-layout-margin-top: 10px;
      --pool-right-panel-padding: 14px;
      --pool-summary-panel-padding: 12px;
      --pool-section-column-gap: 24px;
      --pool-line-margin-y: 20px;
      --pool-embedded-summary-margin-top: 16px;
      --pool-input-row-gap: 8px;
      --pool-embedded-action-row-gap: 8px;
      --pool-embedded-action-margin-top: 14px;
      --pool-embedded-trade-button-margin-top: 12px;
      --pool-select-wrapper-gap: 12px;
      --pool-select-wrapper-margin-y: 18px;
      --pool-trade-summary-row-pad: 14px;
      --pool-summary-title-margin-right: 30px;
      --pool-trade-summary-td-label-pad-right: 30px;
      --pool-summary-container-margin-bottom: 14px;
      --pool-summary-header-margin-bottom: 14px;
      --pool-empty-pool-padding-y: 24px;
      --pool-block-label-margin-bottom: 8px;
      --pool-hint-margin-top: 6px;
      --pool-embedded-exchange-margin-block-start: 4px;
      --pool-embedded-exchange-margin-block-end: 10px;

      @media (max-width: 1080px) {
        --pool-card-padding: 14px;
        --pool-block-padding: 10px;
        --pool-block-margin-bottom: 9px;
        --pool-grid-gap: 17px;
        --pool-embedded-layout-margin-top: 9px;
        --pool-right-panel-padding: 12px;
        --pool-summary-panel-padding: 10px;
        --pool-section-column-gap: 21px;
        --pool-line-margin-y: 17px;
        --pool-embedded-summary-margin-top: 17px;
        --pool-input-row-gap: 7px;
        --pool-embedded-action-row-gap: 7px;
        --pool-embedded-action-margin-top: 12px;
        --pool-embedded-trade-button-margin-top: 10px;
        --pool-select-wrapper-gap: 10px;
        --pool-select-wrapper-margin-y: 16px;
        --pool-trade-summary-row-pad: 12px;
        --pool-summary-title-margin-right: 26px;
        --pool-trade-summary-td-label-pad-right: 26px;
        --pool-summary-container-margin-bottom: 12px;
        --pool-summary-header-margin-bottom: 12px;
        --pool-empty-pool-padding-y: 21px;
        --pool-block-label-margin-bottom: 7px;
        --pool-hint-margin-top: 5px;
        --pool-embedded-exchange-margin-block-start: 3px;
        --pool-embedded-exchange-margin-block-end: 9px;
      }

      @media (max-width: 480px) {
        #btn_install {
       margin-left: 0 !important;
          margin-top: 10px;
        }
      }
    }

    * {
      box-sizing: border-box;
      outline: none;
    }
    html {
      margin: 0;
      padding: 0;
      height: 100%;
      width: 100%;
      overflow-x: hidden;
      overscroll-behavior: none;
    }

    /* No overflow rule on body: with html's overflow-x set, a body overflow
       would make body its own scroll container of viewport height instead of
       letting the document scroll (window.scrollTo, sticky, IntersectionObserver
       all target the viewport). */
    body {
      margin: 0;
      padding: 0;
      min-height: 100%;
      width: 100%;
      min-width: 0;
      overscroll-behavior: none;
      touch-action: pan-y pinch-zoom;
      font-family: var(--font-sans);
      font-weight: 600;
      font-size: 14px;
      color: white;
    }

    /* Same shell as Window (Utils.isWeb() || Utils.isMobile()); fills viewport behind TopNav.
       Fixed so the gradient spans the viewport instead of stretching over the
       whole (long) document; the solid colour covers the first paint. */
    body.web,
    body.mobile {
      background-color: var(--color-darkest-blue);
      background-image: var(--gradient-page);
      background-attachment: fixed;
      background-blend-mode: normal, multiply, multiply, multiply;
      min-height: 100vh;
    }

    /* Desktop-wallet host: clear the dark first-paint background inlined in
       index.html so the wallet supplies its own backdrop. Class-based on
       purpose — html:has() is Chrome 105+ and silently dead in the wallet. */
    html.desktop {
      background: none;
    }

    /* Column shell: TopNav, page, footer. The Footer's spacer takes the
       leftover height, so on short pages the footer sits at the bottom of the
       viewport instead of mid-screen. */
    #root {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
      width: 100%;
      max-width: 100%;
    }

    ::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }
    ::-webkit-scrollbar-track {
      background: transparent;
    }
    ::-webkit-scrollbar-thumb {
      border-radius: 3px;
      background-color: rgba(255, 255, 255, 0.2);
    }

    p {
      margin: 0;
    }

    h1,
    h2 {
      margin: 0;
    }

    ul,
    ol :not(.description) {
      margin: 0;
      padding: 0;
    }

    tr,
    th,
    table {
      border: none;
      border-spacing: 0;
      padding: 0;
      margin: 0;
      border-collapse: inherit;
    }
  }
  }
`;
