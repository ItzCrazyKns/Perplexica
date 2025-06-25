import { IncomingMessage } from 'http';
import geoip from 'geoip-lite';
import { find as geoTz } from 'geo-tz';

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
  const ip = getIPAddress(req);
  const geo = geoip.lookup(ip);
  let timeZone = 'UTC';
  if (geo && geo.ll) {
    timeZone = geoTz(geo.ll[0], geo.ll[1])[0];
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
    timeZoneName: 'short'
  });
}