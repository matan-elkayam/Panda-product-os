import { auth, signOut } from '@panda/auth';
import { redirect } from 'next/navigation';

export default async function AppHomePage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  return (
    <main dir="rtl" style={{ padding: '2rem' }}>
      <p className="eyebrow">Panda Product OS</p>
      <h1>סביבת העבודה מוגנת</h1>
      <p>מחובר כ־{session.user.email ?? session.user.name ?? 'משתמש'}</p>
      <form
        action={async () => {
          'use server';
          await signOut({ redirectTo: '/login' });
        }}
      >
        <button type="submit">התנתקות</button>
      </form>
    </main>
  );
}
