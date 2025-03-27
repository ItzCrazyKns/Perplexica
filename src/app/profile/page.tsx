import { auth0 } from '@/lib/auth0';

export default async function ProfilePage() {
  const session = await auth0.getSession();

  if (!session) {
    return (
      <main>
        <h2>❌ Not logged in</h2>
        <a href="/auth/login">Log in</a>
      </main>
    );
  }

  return (
    <main>
      <h2>✅ Logged in as {session.user.name}</h2>
      <p>Email: {session.user.email}</p>
      <img src={session.user.picture} alt="avatar" width={100} />
      <br />
      <a href="/auth/logout">Log out</a>
    </main>
  );
}
