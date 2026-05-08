/**
 * Returns true for IPv4/IPv6 addresses in private, loopback, link-local, or
 * unspecified ranges. Pulled out so we can unit-test it without DNS.
 */
export function isPrivateOrLoopback(ip: string): boolean {
  if (ip === '::1' || ip === '::') return true;
  if (ip.startsWith('fe80:') || ip.startsWith('fc') || ip.startsWith('fd')) return true;
  const m = ip.match(/^(\d+)\.(\d+)\.(\d+)\.\d+$/);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (a === 10 || a === 127) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 0) return true;
  return false;
}
