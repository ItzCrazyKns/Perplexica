import { NextResponse } from 'next/server';
import { getBaseUrl } from '@/lib/config';

/**
 * Creates an OpenSearch XML response with the given origin URL
 */
function generateOpenSearchResponse(origin: string): NextResponse {
  const opensearchXml = `<?xml version="1.0" encoding="utf-8"?>
<OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/" xmlns:moz="http://www.mozilla.org/2006/browser/search/">
  <ShortName>Perplexica</ShortName>
  <LongName>Search with Perplexica AI</LongName>
  <Description>Perplexica is a powerful AI-driven search engine that understands your queries and delivers relevant results.</Description>
  <InputEncoding>UTF-8</InputEncoding>
  <Image width="16" height="16" type="image/x-icon">${origin}/favicon.ico</Image>
  <Url type="text/html" template="${origin}/?q={searchTerms}"/>
  <Url type="application/opensearchdescription+xml" rel="self" template="${origin}/api/opensearch"/>
</OpenSearchDescription>`;

  return new NextResponse(opensearchXml, {
    headers: {
      'Content-Type': 'application/opensearchdescription+xml',
    },
  });
}

export async function GET(request: Request) {
  // Check if a BASE_URL is explicitly configured
  const configBaseUrl = getBaseUrl();
  
  // If BASE_URL is configured, use it, otherwise detect from request
  if (configBaseUrl) {
    // Remove any trailing slashes for consistency
    let origin = configBaseUrl.replace(/\/+$/, '');
    return generateOpenSearchResponse(origin);
  }
  
  // Detect the correct origin, taking into account reverse proxy headers
  const url = new URL(request.url);
  let origin = url.origin;
  
  // Extract headers
  const headers = Object.fromEntries(request.headers);
  
  // Check for X-Forwarded-Host and related headers to handle reverse proxies
  if (headers['x-forwarded-host']) {
    // Determine protocol: prefer X-Forwarded-Proto, fall back to original or https
    const protocol = headers['x-forwarded-proto'] || url.protocol.replace(':', '');
    // Build the correct public-facing origin
    origin = `${protocol}://${headers['x-forwarded-host']}`;
    
    // Handle non-standard ports if specified in X-Forwarded-Port
    if (headers['x-forwarded-port']) {
      const port = headers['x-forwarded-port'];
      // Don't append standard ports (80 for HTTP, 443 for HTTPS)
      if (!((protocol === 'http' && port === '80') || (protocol === 'https' && port === '443'))) {
        origin = `${origin}:${port}`;
      }
    }
  }
  
  // Generate and return the OpenSearch response
  return generateOpenSearchResponse(origin);
}
