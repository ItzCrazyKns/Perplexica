import { IncomingMessage } from 'http';

// Safe imports for GeoIP functionality
let geoip: any = null;
let geoTz: any = null;

try {
  geoip = require('geoip-lite');
  const geoTzModule = require('geo-tz');
  geoTz = geoTzModule.find;
} catch (error) {
  console.warn(
    'GeoIP functionality disabled:',
    error instanceof Error ? error.message : String(error),
  );
}

/**
 * Extracts the client's IP address from an HTTP request.
 */
export function getIPAddress(req: IncomingMessage): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0];
  } else if (Array.isArray(forwarded)) {
    return forwarded[0];
  }
  return req.socket.remoteAddress || '127.0.0.1';
}

/**
 * Determines the local time zone from the request's IP address.
 */
export function getTimeZoneFromRequest(req: IncomingMessage): string {
  if (!geoip || !geoTz) {
    return 'UTC'; // Fallback when GeoIP is not available
  }

  const ip = getIPAddress(req);
  const geo = geoip.lookup(ip);
  let timeZone = 'UTC';

  try {
    if (geo && geo.ll) {
      timeZone = geoTz(geo.ll[0], geo.ll[1])[0];
    }
  } catch (error) {
    console.warn(
      'GeoIP lookup failed:',
      error instanceof Error ? error.message : String(error),
    );
  }

  return timeZone;
}

/**
 * Returns a local date string adjusted to the request's time zone.
 */
export function getLocalDateFromRequest(req: IncomingMessage): string {
  const timeZone = getTimeZoneFromRequest(req);
  return new Date().toLocaleString('en-US', {
    timeZone,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    timeZoneName: 'short',
  });
}
