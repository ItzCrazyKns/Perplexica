import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import db from '@/lib/db';
import {
  exchangeCodeForToken,
  getClientCredentials,
  getPublicOrigin,
  getRedirectUri,
} from '@/lib/connectors/notion/oauth';
import { upsertConnection } from '@/lib/connectors/notion/store';
import { encryptToken } from '@/lib/connectors/notion/token';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const redirectHome = (req: Request, status: string) => {
  const res = NextResponse.redirect(
    new URL(`/?notion=${status}`, getPublicOrigin(req)),
  );
  res.cookies.set('notion_oauth_state', '', {
    httpOnly: true,
    maxAge: 0,
    path: '/',
  });
  return res;
};

export const GET = async (req: Request) => {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  console.log(
    `[notion-callback] received code=${code ? 'yes' : 'no'} state=${state ? 'yes' : 'no'} error=${error ?? 'none'}`,
  );

  // CSRF check first — on success AND on the error path: an attacker who
  // cannot supply the matching state must not be able to abort an
  // in-progress authorization by hitting `?error=...`.
  const cookieStore = await cookies();
  const expectedState = cookieStore.get('notion_oauth_state')?.value;

  if (!state || !expectedState || state !== expectedState) {
    console.log(
      `[notion-callback] state mismatch (got=${state ?? 'none'} expected=${expectedState ? 'yes' : 'none'}) -> error`,
    );
    return redirectHome(req, 'error');
  }

  // Notion echoes the state back, so a legitimate denial carries it too.
  if (url.searchParams.get('error')) {
    console.log(
      `[notion-callback] Notion denied: ${url.searchParams.get('error')} -> error`,
    );
    return redirectHome(req, 'error');
  }

  if (!code) {
    console.log('[notion-callback] no code -> error');
    return redirectHome(req, 'error');
  }

  const credentials = getClientCredentials();
  if (!credentials) {
    console.log('[notion-callback] missing client credentials -> error');
    return redirectHome(req, 'error');
  }

  try {
    const redirectUri = getRedirectUri(req);
    console.log(
      `[notion-callback] exchanging code with redirect_uri=${redirectUri}`,
    );
    const token = await exchangeCodeForToken({
      clientId: credentials.clientId,
      clientSecret: credentials.clientSecret,
      code,
      redirectUri,
    });

    upsertConnection(db, {
      workspaceId: token.workspaceId,
      workspaceName: token.workspaceName,
      encryptedToken: encryptToken(token.accessToken),
    });

    console.log(
      `[notion-callback] connection stored for workspace "${token.workspaceName}" -> connected`,
    );

    return redirectHome(req, 'connected');
  } catch (err) {
    console.error('Failed to store Notion connection:', err);
    return redirectHome(req, 'error');
  }
};
