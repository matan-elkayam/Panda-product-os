import { LoginForm } from './login-form';

export default function LoginPage() {
  return (
    <main className="auth-shell" dir="rtl">
      <section>
        <p className="eyebrow">Panda Product OS</p>
        <h1>כניסה למערכת</h1>
        <p>התחברות מאובטחת לסביבת העבודה שלך.</p>
        <LoginForm />
      </section>
    </main>
  );
}
