import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { css } from '@linaria/core';
import { ROUTES } from '@app/shared/constants';
import { SearchOverlay } from './SearchOverlay';

const navRoot = css`
  width: 100%;
  display: flex;
  justify-content: center;
  margin: 14px 0 10px;
`;

const navInner = css`
  width: 100%;
  max-width: 1400px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: space-between;
  padding: 0 20px;

  @media (max-width: 600px) {
    padding: 0 12px;
  }
`;

// Logo + wordmark, links home. On hover the logo grows and its rays are wiped
// away from the centre (the mask circle scales up) — the Beam Explorer effect,
// done in CSS instead of a requestAnimationFrame loop.
const brand = css`
  display: flex;
  align-items: center;
  flex-shrink: 0;
  text-decoration: none;
  padding: 6px 0;

  svg {
    transition: transform 0.6s ease;
  }
  .beam-logo-wipe {
    transform: scale(0);
    transform-box: fill-box;
    transform-origin: center;
    transition: transform 0.6s linear;
  }

  &:hover svg {
    transform: scale(1.15);
  }
  &:hover .beam-logo-wipe {
    transform: scale(1);
  }
`;

const logoIcon = css`
  width: 40px;
  height: 28px;
  display: block;
  flex-shrink: 0;
`;

const wordmark = css`
  margin-left: 10px;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.2px;
  color: var(--color-white);
  white-space: nowrap;

  @media (max-width: 480px) {
    display: none;
  }
`;

// Links sit right of the search bar. Once brand + search + links no longer fit
// on one line they drop to their own full-width row beneath both.
const linksWrap = css`
  flex: 1 1 auto;
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  & > * {
    margin-bottom: 4px;
  }

  @media (max-width: 1100px) {
    order: 3;
    flex-basis: 100%;
    justify-content: center;
    margin-top: 10px;
  }
`;

const navLink = css`
  text-decoration: none;
  text-transform: uppercase;
  font-size: 13px;
  font-weight: 700;
  padding: 8px 18px;
  color: rgba(255, 255, 255, 0.6);
  border-bottom: 2px solid transparent;

  &[aria-current='page'] {
    color: white;
    border-bottom-color: var(--color-green);
  }

  @media (max-width: 600px) {
    font-size: 12px;
    padding: 6px 12px;
  }
`;

// Search reads as an input, not a pill: it's the fastest way into the explorer
// (blocks, kernels, assets, pairs…), so it sits right after the brand where the
// eye lands first. Clicking or ⌘K/Ctrl K opens SearchOverlay.
const searchBar = css`
  flex: 0 1 420px;
  min-width: 0;
  display: flex;
  align-items: center;
  height: 40px;
  margin: 0 24px;
  padding: 0 10px 0 14px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.07);
  color: rgba(255, 255, 255, 0.55);
  font-size: 14px;
  text-align: left;
  cursor: text;
  transition: border-color 0.15s ease, background 0.15s ease;

  &:hover {
    border-color: rgba(0, 246, 210, 0.55);
    background: rgba(255, 255, 255, 0.1);
  }
  &:focus-visible {
    outline: none;
    border-color: var(--color-green);
    box-shadow: 0 0 0 3px rgba(0, 246, 210, 0.2);
  }

  @media (max-width: 1100px) {
    flex: 1 1 auto;
    margin-right: 0;
  }
  @media (max-width: 600px) {
    height: 36px;
    margin-left: 12px;
    font-size: 13px;
  }
`;
const searchIcon = css`
  width: 15px;
  height: 15px;
  margin-right: 10px;
  flex-shrink: 0;
  color: var(--color-green);
`;
const searchText = css`
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
`;
const searchKbd = css`
  flex-shrink: 0;
  margin-left: 10px;
  font-size: 11px;
  line-height: 1;
  color: rgba(255, 255, 255, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 5px;
  padding: 4px 6px;

  /* Touch devices have no shortcut to advertise. */
  @media (max-width: 600px) {
    display: none;
  }
`;

const SHORTCUT = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl K';

const items = [
  { to: ROUTES.NAV.EXPLORER, label: 'Explorer' },
  { to: ROUTES.NAV.DEX, label: 'DEX' },
  { to: ROUTES.NAV.ASSETS, label: 'Assets' },
  { to: ROUTES.NAV.ATOMIC_SWAPS, label: 'Atomic swaps' },
  { to: ROUTES.NAV.ASSET_SWAPS, label: 'Asset swaps' },
  { to: ROUTES.NAV.DAPPS, label: 'DApps' },
];

// BEAM logo from the Beam Explorer (the triangle plus four rays). Gradient and
// mask ids are prefixed: they're document-global, and TopNav renders once.
// favicon.svg is the same drawing without the hover mask.
const BeamLogo = () => (
  <svg className={logoIcon} viewBox="0 0 57 40" xmlns="http://www.w3.org/2000/svg" aria-label="BEAM">
    <defs>
      <linearGradient id="bt-logo-outer" x1="0%" x2="100%" y1="50%" y2="50%">
        <stop offset="0%" stopColor="#24C1FF" />
        <stop offset="48.99%" stopColor="#24C1FF" />
        <stop offset="49%" stopColor="#0B76FF" />
        <stop offset="100%" stopColor="#0B76FF" />
      </linearGradient>
      <linearGradient id="bt-logo-inner" x1="0%" x2="100%" y1="50%" y2="50%">
        <stop offset="0%" stopColor="#6BFFFA" />
        <stop offset="49.99%" stopColor="#6BFFFA" />
        <stop offset="50%" stopColor="#00E2C2" />
        <stop offset="100%" stopColor="#00E2C2" />
      </linearGradient>
      <linearGradient id="bt-logo-ray1" x1="0%" x2="54.8%" y1="50.2%" y2="50.2%">
        <stop offset="0%" stopOpacity="0" />
        <stop offset="100%" stopColor="#FFF" />
      </linearGradient>
      <linearGradient id="bt-logo-ray2" x1="99.4%" x2="35.8%" y1="49.8%" y2="49.8%">
        <stop offset="0%" stopOpacity="0" />
        <stop offset="100%" stopColor="#FF51FF" />
      </linearGradient>
      <linearGradient id="bt-logo-ray3" x1="100.4%" x2="48.9%" y1="50.1%" y2="50.1%">
        <stop offset="0%" stopOpacity="0" />
        <stop offset="100%" stopColor="#A18CFF" />
      </linearGradient>
      <linearGradient id="bt-logo-ray4" x1="99.9%" x2="41.1%" y1="50.2%" y2="50.2%">
        <stop offset="0%" stopOpacity="0" />
        <stop offset="100%" stopColor="#AB38E6" />
      </linearGradient>
      <mask id="bt-logo-rays-mask">
        <rect width="100%" height="100%" fill="white" />
        <circle className="beam-logo-wipe" cx="28.5" cy="20" r="30" fill="black" />
      </mask>
    </defs>
    <path fill="url(#bt-logo-outer)" d="M28 0L52 40H4L28 0Zm0 13L17 33h22L28 13Z" />
    <path fill="url(#bt-logo-inner)" d="M28 18l8 13H21z" />
    <g mask="url(#bt-logo-rays-mask)">
      <path fill="url(#bt-logo-ray1)" d="m0 13 28 13v1L0 21z" />
      <path fill="url(#bt-logo-ray2)" d="M57 9 28 26l29-12z" />
      <path fill="url(#bt-logo-ray3)" d="m57 25-29 2 29-7z" />
      <path fill="url(#bt-logo-ray4)" d="M57 14 28 26v1l29-7z" />
    </g>
  </svg>
);

export const TopNav = () => {
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <nav className={navRoot}>
        <div className={navInner}>
          <NavLink to={ROUTES.NAV.EXPLORER_CHARTS} end className={brand}>
            <BeamLogo />
            <span className={wordmark}>Beam Explorer</span>
          </NavLink>

          <button
            type="button"
            className={searchBar}
            onClick={() => setSearchOpen(true)}
            aria-label="Search blocks, kernels, assets, pairs, dapps and contracts"
          >
            {/* Magnifier from beam-ui (ui/view/assets/icon-search.svg), recoloured via currentColor. */}
            <svg className={searchIcon} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path
                fillRule="nonzero"
                d="M14.787 13.752l-3.451-3.466a5.519 5.519 0 0 0 1.373-3.634C12.71 3.536 10.083 1 6.855 1 3.626 1 1 3.536 1 6.652c0 3.117 2.626 5.653 5.855 5.653a5.936 5.936 0 0 0 3.354-1.023l3.477 3.492c.146.146.341.226.55.226a.774.774 0 0 0 .53-.206.72.72 0 0 0 .021-1.042zM6.855 2.475c2.386 0 4.327 1.874 4.327 4.177 0 2.304-1.941 4.178-4.327 4.178S2.527 8.956 2.527 6.652c0-2.303 1.942-4.177 4.328-4.177z"
              />
            </svg>
            <span className={searchText}>Search blocks, kernels, assets, pairs…</span>
            <span className={searchKbd}>{SHORTCUT}</span>
          </button>

          <div className={linksWrap}>
            {items.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.to === ROUTES.NAV.DEX} className={navLink}>
                {item.label}
              </NavLink>
            ))}
          </div>
        </div>
      </nav>
      {searchOpen && <SearchOverlay onClose={() => setSearchOpen(false)} />}
    </>
  );
};

export default TopNav;
