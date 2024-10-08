'use client'

import { useEffect } from 'react'
import Cookies from 'js-cookie'

export default function AuthSettingsHandler() {
  useEffect(() => {
    const fetchAuthSettings = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth-settings`, {
          headers: {
            'Content-Type': 'application/json',
          },
        })
        const data = await res.json()

        if (data.isEnabled) {
          Cookies.set('authEnabled', 'true', { expires: 7, path: '/' })
          Cookies.set('authUsername', data.username, { expires: 7, path: '/' })
          Cookies.set('authPassword', data.password, { expires: 7, path: '/' })
        } else {
          Cookies.remove('authEnabled', { path: '/' })
          Cookies.remove('authUsername', { path: '/' })
          Cookies.remove('authPassword', { path: '/' })
        }
      } catch (error) {
        console.error('Error fetching auth settings:', error)
      }
    }

    fetchAuthSettings()
  }, [])

  return null
}
