// Pure helpers shared by the browser and the API routes (no Node-only imports).
export const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]{2,}$/;
export const MAX_PER_RUN = 50;

export type Vars = Record<string, string>;

// Variables a template may use as {{name}}. unsubscribe_link is filled by the system.
export const VARIABLES = ['clinic_name', 'contact_name', 'first_name', 'company', 'website', 'city', 'province_state', 'phone', 'email'];

export const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Names of the variables a piece of template text uses, e.g. ["clinic_name", "unsubscribe_link"]. */
export function tokensIn(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/gi)) out.add(m[1].toLowerCase());
  if (text.includes('UNSUBSCRIBE_LINK')) out.add('unsubscribe_link');
  return Array.from(out);
}

/** Fill {{variables}} (and the UNSUBSCRIBE_LINK placeholder). html=true escapes values. */
export function renderTemplate(src: string, vars: Vars, html: boolean): string {
  const val = (k: string) => {
    const v = vars[k] ?? '';
    return html && k !== 'unsubscribe_link' ? esc(v) : v;
  };
  return src
    .replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_m, k: string) => val(String(k).toLowerCase()))
    .replace(/UNSUBSCRIBE_LINK/g, vars.unsubscribe_link ?? '');
}

export function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(br|\/p|\/div|\/tr|\/h[1-6])[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim();
}

/** Template subject from <title>, minus the brand suffix. */
export function subjectFromHtml(html: string): string {
  const m = html.match(/<title>([\s\S]*?)<\/title>/i);
  return (m ? m[1] : '').replace(/\s*[—–-]\s*Valioz Health\s*$/i, '').replace(/\s+/g, ' ').trim();
}

export function categoryFromFile(file: string): string {
  const f = file.toLowerCase();
  if (f.includes('welcome')) return 'Welcome';
  if (f.includes('pas')) return 'PAS awareness';
  if (f.includes('aida')) return 'AIDA conversion';
  if (f.includes('case')) return 'Case study';
  if (f.includes('urgency')) return 'Urgency';
  return 'General';
}
