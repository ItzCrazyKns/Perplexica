// components/Header.tsx
'use client'

import { useUser } from '@auth0/nextjs-auth0'
import Link from 'next/link'
import Image from 'next/image'

export default function Header() {
  const { user, error, isLoading } = useUser()

  if (isLoading) return <div className="p-4 bg-gray-100">Loading...</div>
  if (error) return <div className="p-4 bg-red-100 text-red-600">{error.message}</div>

  return (
    <header className="flex justify-between items-center px-6 py-4 bg-white border-b shadow-sm">
      <div className="text-xl font-bold">My App</div>
      <nav className="flex items-center gap-4">
        {user ? (
          <>
            {/* <div className="flex items-center gap-2">
              {user.picture && (
                <Image
                  src={user.picture}
                  alt={user.name || 'User'}
                  width={32}
                  height={32}
                  className="rounded-full"
                />
              )}
              <span>{user.name}</span>
            </div> */}
            <Link
              href="auth/logout"
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition"
            >
              Logout
            </Link>
          </>
        ) : (
          <Link
            href="auth/login"
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
          >
            Login
          </Link>
        )}
      </nav>
    </header>
  )
}
