import { NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  buildAuthorizeUrl,
  getClientCredentials,
  getPublicOrigin,
  getRedirectUri,
} from '@/lib/connectors/notion/oauth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = async (req: Request) => {
  const credentials = getClientCredentials();

  if (!credentials) {
    return NextResponse.json(
      {
        message:
          'NOTION_CLIENT_ID and NOTION_CLIENT_SECRET must be set in the environment',
      },
      { status: 500 },
    );
  }

  const state = crypto.randomBytes(16).toString('hex');
  const redirectUri = getRedirectUri(req);
  const authorizeUrl = buildAuthorizeUrl({
    clientId: credentials.clientId,
    redirectUri,
    state,
  });

  console.log(
    `[notion-auth] redirect_uri=${redirectUri} authorize_url=${authorizeUrl}`,
  );

  const res = NextResponse.redirect(authorizeUrl);
  res.cookies.set('notion_oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: new URL(getPublicOrigin(req)).protocol === 'https:',
    maxAge: 600,
    path: '/',
  });
  return res;
};
