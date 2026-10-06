'use client';

import { useActionState } from 'react';
import { authenticate } from './actions';

export function LoginForm() {
  const [error, action, pending] = useActionState(authenticate, undefined);

  return (
    <form action={action} className="auth-card">
      <div>
        <label htmlFor="email">אימייל</label>
        <input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div>
        <label htmlFor="password">סיסמה</label>
        <input id="password" name="password" type="password" autoComplete="current-password" minLength={12} required />
      </div>
      {error ? <p role="alert" className="auth-error">{error}</p> : null}
      <button type="submit" disabled={pending}>{pending ? 'מתחבר…' : 'כניסה'}</button>
    </form>
  );
}
