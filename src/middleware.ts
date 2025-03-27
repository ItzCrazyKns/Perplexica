import { NextRequest, NextResponse } from "next/server"

import { auth0 } from "@/lib/auth0"

export async function middleware(request: NextRequest) {
  const authRes = await auth0.middleware(request)

  if (request.nextUrl.pathname.startsWith("/auth")) {
    return authRes
  }

  const session = await auth0.getSession(request)

  if (!session) {
    // user is not authenticated, redirect to login page
    return NextResponse.redirect(new URL("/auth/login", request.nextUrl.origin))
  }

  // the headers from the auth middleware should always be returned
  return authRes
}

// export const config = {
//   matcher: [
//     /*
//      * Match all paths except:
//      * - public files (_next, images, icons, etc.)
//      * - auth routes like /auth/login and /auth/callback
//      */
//     '/((?!_next/static|_next/image|favicon.ico|auth/.*).*)',
//   ],
// };