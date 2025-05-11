import { NextResponse } from 'next/server';
import { getSearxngApiEndpoint } from '@/lib/config';

/**
 * Proxies autocomplete requests to SearXNG
 */
export async function GET(request: Request) {
  try {
    // Get the query parameter from the request URL
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    // Check if query exists
    if (!query) {
      return new NextResponse(JSON.stringify([query || '', []]), {
        headers: {
          'Content-Type': 'application/x-suggestions+json',
        },
      });
    }

    // Get the SearXNG API endpoint
    const searxngUrl = getSearxngApiEndpoint();

    if (!searxngUrl) {
      console.error('SearXNG API endpoint not configured');
      return new NextResponse(JSON.stringify([query, []]), {
        headers: {
          'Content-Type': 'application/x-suggestions+json',
        },
      });
    }

    // Format the URL (remove trailing slashes)
    const formattedSearxngUrl = searxngUrl.replace(/\/+$/, '');
    const autocompleteUrl = `${formattedSearxngUrl}/autocompleter?q=${encodeURIComponent(query)}`;

    // Make the request to SearXNG
    const response = await fetch(autocompleteUrl, {
      method: 'POST', // The example XML used POST method
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      signal: AbortSignal.timeout(3000), // 3 second timeout
    });

    if (!response.ok) {
      console.error(
        `SearXNG autocompleter returned status: ${response.status}`,
      );
      return new NextResponse(JSON.stringify([query, []]), {
        headers: {
          'Content-Type': 'application/x-suggestions+json',
        },
      });
    }

    // Get the JSON response from SearXNG
    const suggestions = await response.json();

    // Return the suggestions in the expected format
    console.log('SearXNG autocompleter response:', suggestions);
    return new NextResponse(JSON.stringify(suggestions), {
      headers: {
        'Content-Type': 'application/x-suggestions+json',
      },
    });
  } catch (error) {
    console.error('Error proxying to SearXNG autocompleter:', error);

    // Return an empty suggestion list on error
    const query = new URL(request.url).searchParams.get('q') || '';
    return new NextResponse(JSON.stringify([query, []]), {
      headers: {
        'Content-Type': 'application/x-suggestions+json',
      },
    });
  }
}
