import dns from 'node:dns/promises';
import net from 'node:net';

/*
 * SSRF guard for URLs fetched on behalf of model or user input.
 * Provider baseURLs are exempt by design: pointing at LAN hosts
 * (Ollama, LM Studio, SearXNG) is the primary self-hosted use case.
 */

const isPrivateV4 = (ip: string): boolean => {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return true;
  const [a, b] = parts;

  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 192 && b === 0) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a >= 224) return true;

  return false;
};

/*
 * Expands an IPv6 address to its 8 hextets. Returns null when the
 * address does not parse, so callers can fail closed.
 */
const expandV6 = (ip: string): number[] | null => {
  let rest = ip;
  let embeddedV4: number[] | null = null;

  const dotted = rest.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) {
    const octets = dotted[1].split('.').map(Number);
    if (octets.some((o) => Number.isNaN(o) || o > 255)) return null;
    embeddedV4 = octets;
    rest = rest.slice(0, dotted.index);
  }

  const halves = rest.split('::');
  if (halves.length > 2) return null;

  const toHextets = (s: string) =>
    s.split(':').filter((p) => p !== '').map((p) => parseInt(p, 16));

  const head = toHextets(halves[0] ?? '');
  const tail = halves.length === 2 ? toHextets(halves[1]) : [];

  if ([...head, ...tail].some((h) => Number.isNaN(h))) return null;

  const v4Hextets = embeddedV4
    ? [(embeddedV4[0] << 8) | embeddedV4[1], (embeddedV4[2] << 8) | embeddedV4[3]]
    : [];

  const known = head.length + tail.length + v4Hextets.length;
  if (known > 8) return null;

  const gap =
    halves.length === 2 ? new Array(8 - known).fill(0) : [];

  const full = [...head, ...gap, ...tail, ...v4Hextets];

  return full.length === 8 ? full : null;
};

const isPrivateIp = (ip: string): boolean => {
  const version = net.isIP(ip);

  if (version === 4) return isPrivateV4(ip);

  if (version === 6) {
    const hextets = expandV6(ip.toLowerCase());
    if (!hextets) return true;

    const isZero = (n: number) => n === 0;

    /* Unspecified (::) and loopback (::1). */
    if (hextets.slice(0, 7).every(isZero) && hextets[7] <= 1) return true;

    /* IPv4-mapped (::ffff:0:0/96) and IPv4-compatible (::/96): both
       tunnel a v4 address that must be judged by v4 rules. Node's URL
       parser normalizes the dotted form to hex, so match on hextets. */
    const v4Embedded =
      hextets.slice(0, 5).every(isZero) &&
      (hextets[5] === 0xffff || hextets[5] === 0);

    if (v4Embedded) {
      const a = hextets[6] >> 8;
      const b = hextets[6] & 0xff;
      const c = hextets[7] >> 8;
      const d = hextets[7] & 0xff;
      return isPrivateV4(`${a}.${b}.${c}.${d}`);
    }

    /* Unique local (fc00::/7) and link-local (fe80::/10). */
    if ((hextets[0] & 0xfe00) === 0xfc00) return true;
    if ((hextets[0] & 0xffc0) === 0xfe80) return true;

    return false;
  }

  return true;
};

const dnsVerdictCache = new Map<string, boolean>();
const DNS_CACHE_MAX = 1000;

/*
 * Best-effort check: resolves the hostname once, so a DNS-rebinding
 * attacker with a short TTL can still race the browser's own lookup.
 * Combined with per-navigation re-checks in the scraper this raises
 * the bar enough for a self-hosted deployment.
 */
export const isPublicHttpUrl = async (raw: string): Promise<boolean> => {
  let url: URL;

  try {
    url = new URL(raw);
  } catch {
    return false;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;

  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();

  if (net.isIP(host)) return !isPrivateIp(host);

  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host === 'metadata.google.internal'
  ) {
    return false;
  }

  const cached = dnsVerdictCache.get(host);
  if (cached !== undefined) return cached;

  let verdict = false;

  try {
    const addrs = await dns.lookup(host, { all: true, verbatim: true });
    verdict = addrs.length > 0 && addrs.every((a) => !isPrivateIp(a.address));
  } catch {
    verdict = false;
  }

  if (dnsVerdictCache.size >= DNS_CACHE_MAX) dnsVerdictCache.clear();
  dnsVerdictCache.set(host, verdict);

  return verdict;
};

export const assertPublicHttpUrl = async (raw: string): Promise<void> => {
  if (process.env.VANE_ALLOW_PRIVATE_SCRAPE === 'true') return;

  if (!(await isPublicHttpUrl(raw))) {
    throw new Error(
      `Refusing to fetch non-public URL: ${raw}. Set VANE_ALLOW_PRIVATE_SCRAPE=true to allow scraping private networks.`,
    );
  }
};
