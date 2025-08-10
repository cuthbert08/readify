
'use server';

import { Resend } from 'resend';
import { WelcomeEmail } from '@/components/emails/welcome-email';

const resend = new Resend(process.env.RESEND_API_KEY);
const fromEmail = process.env.FROM_EMAIL || 'onboarding@resend.dev';

export async function sendWelcomeEmail(
  to: string,
  name: string,
  setupLink: string
) {
  try {
    const { data, error } = await resend.emails.send({
      from: `Readify <${fromEmail}>`,
      to,
      subject: 'Welcome to Readify! Complete Your Account Setup',
      react: WelcomeEmail({ name, setupLink }),
    });

    if (error) {
      console.error('Resend Error:', error);
      throw new Error('Failed to send welcome email.');
    }

    console.log('Welcome email sent successfully:', data?.id);
    return data;
  } catch (error) {
    console.error('Error in sendWelcomeEmail:', error);
    throw error;
  }
}
