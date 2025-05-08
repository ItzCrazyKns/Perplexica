import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  // Get the host from the request
  const url = new URL(request.url);
  const origin = url.origin;

  // Create the OpenSearch XML with the correct origin
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

  // Return the XML with the correct content type
  return new NextResponse(opensearchXml, {
    headers: {
      'Content-Type': 'application/opensearchdescription+xml',
    },
  });
}
