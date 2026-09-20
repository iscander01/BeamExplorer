// Shared formatters for explorer surfaces. Keep the hashrate convention in ONE
// place so the Mining summary line, NetworkCharts, and the mining calculator
// all render the same value with the same unit string.

// Format a Sol/s hashrate on the Sol/s → KSol/s → MSol/s → GSol/s scale.
export function fmtHashrate(solPerSec: number | null | undefined): string {
  if (solPerSec == null || !Number.isFinite(solPerSec)) return '—';
  const units = ['Sol/s', 'KSol/s', 'MSol/s', 'GSol/s'];
  let v = solPerSec;
  let i = 0;
  while (v >= 1000 && i < units.length - 1) {
    v /= 1000;
    i += 1;
  }
  return `${v.toFixed(2)} ${units[i]}`;
}
