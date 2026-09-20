// Generic browser download helpers, shared across chart engines.
// Lifted verbatim from NetworkCharts so both the explorer/charts modal and the
// HdrsChart extended view share one implementation.

export function triggerDownload(url: string, filename: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function downloadBlob(content: BlobPart, filename: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  triggerDownload(url, filename);
  URL.revokeObjectURL(url);
}

// Rasterise an SVG string to a PNG at `scale`× the intrinsic size, then save it.
export function downloadSvgAsPng(svg: string, filename: string, scale = 2): void {
  const svgUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = img.width * scale;
    canvas.height = img.height * scale;
    const ctx = canvas.getContext('2d');
    URL.revokeObjectURL(svgUrl);
    if (!ctx) return;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((b) => {
      if (!b) return;
      const url = URL.createObjectURL(b);
      triggerDownload(url, filename);
      URL.revokeObjectURL(url);
    }, 'image/png');
  };
  img.src = svgUrl;
}

/** Quote a CSV cell when it holds a comma, quote or newline. */
export function csvField(s: string): string {
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Escape text for an SVG/XML text node. */
export const escapeXml = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
