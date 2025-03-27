'use client';

import { useEffect, useState } from 'react';

interface UserProfile {
  name?: string;
  email?: string;
  picture?: string;
}

export default function ProfileButton() {
  const [user, setUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    fetch('/auth/profile')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setUser(data?.user))
      .catch(() => setUser(null));
  }, []);

  if (!user) return null;

  return (
    <a href="/auth/logout" title="Log out" className="block p-2">
      <img
        src={user.picture}
        alt="profile"
        className="rounded-full w-8 h-8 border border-white/20"
      />
    </a>
  );
}
