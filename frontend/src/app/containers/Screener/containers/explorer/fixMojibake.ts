// Repairs text whose UTF-8 bytes were decoded as a single-byte charset before it
// reached us: "â€”" for an em dash (cp1252), "Ã©" for "é" (latin1). Publishers'
// DApp descriptions arrive like this from the DApp Store.
//
// Only runs that look like a UTF-8 multi-byte sequence read as single bytes are
// touched — a lead byte (C2–F4 as a latin1 char) followed by continuation
// bytes (80–BF, as latin1 or as the cp1252 glyph for that byte). Each run is
// mapped back to bytes and decoded strictly; if it isn't valid UTF-8 the run
// stays as it was, so genuine text is never rewritten.

// cp1252 glyphs for bytes 0x80–0x9F that differ from latin1 (the rest map 1:1).
const CP1252_TO_BYTE: Record<number, number> = {
  0x20ac: 0x80,
  0x201a: 0x82,
  0x0192: 0x83,
  0x201e: 0x84,
  0x2026: 0x85,
  0x2020: 0x86,
  0x2021: 0x87,
  0x02c6: 0x88,
  0x2030: 0x89,
  0x0160: 0x8a,
  0x2039: 0x8b,
  0x0152: 0x8c,
  0x017d: 0x8e,
  0x2018: 0x91,
  0x2019: 0x92,
  0x201c: 0x93,
  0x201d: 0x94,
  0x2022: 0x95,
  0x2013: 0x96,
  0x2014: 0x97,
  0x02dc: 0x98,
  0x2122: 0x99,
  0x0161: 0x9a,
  0x203a: 0x9b,
  0x0153: 0x9c,
  0x017e: 0x9e,
  0x0178: 0x9f,
};

const CONTINUATION =
  '\\u0080-\\u00BF\\u0152\\u0153\\u0160\\u0161\\u0178\\u017D\\u017E\\u0192\\u02C6\\u02DC\\u2013\\u2014' +
  '\\u2018-\\u201E\\u2020-\\u2022\\u2026\\u2030\\u2039\\u203A\\u20AC\\u2122';
const RUN_RE = new RegExp(`[\\u00C2-\\u00F4][${CONTINUATION}]+`, 'g');

function runToBytes(run: string): Uint8Array | null {
  const bytes = new Uint8Array(run.length);
  for (let i = 0; i < run.length; i += 1) {
    const code = run.charCodeAt(i);
    const b = code <= 0xff ? code : CP1252_TO_BYTE[code];
    if (b === undefined) return null;
    bytes[i] = b;
  }
  return bytes;
}

export function fixMojibake(text: string): string {
  if (typeof TextDecoder === 'undefined') return text;
  return text.replace(RUN_RE, (run) => {
    const bytes = runToBytes(run);
    if (!bytes) return run;
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      return run;
    }
  });
}
