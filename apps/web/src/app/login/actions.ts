'use server';

import { signIn } from '@panda/auth';
import { AuthError } from 'next-auth';

export async function authenticate(_previous: string | undefined, formData: FormData) {
  try {
    await signIn('credentials', {
      email: formData.get('email'),
      password: formData.get('password'),
      redirectTo: '/app',
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return error.type === 'CredentialsSignin'
        ? 'פרטי ההתחברות אינם נכונים.'
        : 'לא ניתן להתחבר כרגע. נסה שוב.';
    }
    throw error;
  }
}
