// Browser-only readers for CSV, XLSX and ZIP. No dependencies: XLSX/ZIP are read with DecompressionStream.
export type Sheet = { name: string; rows: string[][] };

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let q = false;
  const src = text.replace(/^﻿/, '');
  // Detect delimiter from the first line.
  const first = src.split(/\r?\n/, 1)[0] ?? '';
  const delim = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : ',';
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (q) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; } else q = false;
      } else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === delim) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      rows.push(row); row = [];
    } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as unknown as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw') as any);
  return new Uint8Array(await new Response(stream as any).arrayBuffer());
}

/** Read every file of a ZIP (name -> bytes). */
export async function readZip(buf: ArrayBuffer): Promise<Record<string, Uint8Array>> {
  const u8 = new Uint8Array(buf);
  const dv = new DataView(buf);
  let eocd = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 70000); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Not a valid ZIP/XLSX file');
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const dec = new TextDecoder();
  const out: Record<string, Uint8Array> = {};
  for (let n = 0; n < count; n++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true);
    const csize = dv.getUint32(p + 20, true);
    const nlen = dv.getUint16(p + 28, true);
    const elen = dv.getUint16(p + 30, true);
    const clen = dv.getUint16(p + 32, true);
    const off = dv.getUint32(p + 42, true);
    const name = dec.decode(u8.subarray(p + 46, p + 46 + nlen));
    p += 46 + nlen + elen + clen;
    if (name.endsWith('/')) continue;
    const lnlen = dv.getUint16(off + 26, true);
    const lelen = dv.getUint16(off + 28, true);
    const start = off + 30 + lnlen + lelen;
    const raw = u8.subarray(start, start + csize);
    out[name] = method === 0 ? raw : await inflateRaw(raw);
  }
  return out;
}

const colIndex = (ref: string): number => {
  const letters = (ref.match(/^[A-Z]+/i) || ['A'])[0].toUpperCase();
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
};

export async function parseXlsx(buf: ArrayBuffer): Promise<Sheet[]> {
  const files = await readZip(buf);
  const dec = new TextDecoder();
  const xml = (name: string): Document | null => {
    const f = files[name];
    return f ? new DOMParser().parseFromString(dec.decode(f), 'application/xml') : null;
  };
  const shared: string[] = [];
  const ss = xml('xl/sharedStrings.xml');
  if (ss) {
    Array.from(ss.getElementsByTagName('si')).forEach((si) => {
      shared.push(Array.from(si.getElementsByTagName('t')).map((t) => t.textContent ?? '').join(''));
    });
  }
  const wb = xml('xl/workbook.xml');
  const rels = xml('xl/_rels/workbook.xml.rels');
  if (!wb || !rels) throw new Error('Not a valid XLSX file');
  const target: Record<string, string> = {};
  Array.from(rels.getElementsByTagName('Relationship')).forEach((r) => {
    target[r.getAttribute('Id') ?? ''] = r.getAttribute('Target') ?? '';
  });
  const sheets: Sheet[] = [];
  for (const s of Array.from(wb.getElementsByTagName('sheet'))) {
    const rid = s.getAttribute('r:id') ?? s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') ?? '';
    let t = target[rid] ?? '';
    t = t.startsWith('/') ? t.slice(1) : 'xl/' + t;
    const doc = xml(t);
    if (!doc) continue;
    const rows: string[][] = [];
    Array.from(doc.getElementsByTagName('row')).forEach((r) => {
      const arr: string[] = [];
      Array.from(r.getElementsByTagName('c')).forEach((c) => {
        const idx = colIndex(c.getAttribute('r') ?? 'A1');
        const type = c.getAttribute('t');
        let v = '';
        if (type === 'inlineStr') v = Array.from(c.getElementsByTagName('t')).map((x) => x.textContent ?? '').join('');
        else {
          const ve = c.getElementsByTagName('v')[0];
          const raw = ve?.textContent ?? '';
          v = type === 's' ? shared[Number(raw)] ?? '' : raw;
        }
        while (arr.length < idx) arr.push('');
        arr[idx] = v;
      });
      rows.push(arr);
    });
    sheets.push({ name: s.getAttribute('name') ?? 'Sheet', rows: rows.filter((r) => r.some((c) => (c ?? '').trim() !== '')) });
  }
  return sheets;
}

export async function readLeadFile(file: File): Promise<Sheet[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.xlsx')) return parseXlsx(await file.arrayBuffer());
  if (name.endsWith('.csv') || name.endsWith('.txt')) return [{ name: 'CSV', rows: parseCsv(await file.text()) }];
  throw new Error('Only .csv and .xlsx files are supported');
}
