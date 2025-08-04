// To run this script:
// 1. Fill in the ADMIN_DETAILS below with your desired admin credentials.
// 2. Open your terminal and run `npm install` to ensure all dependencies are available.
// 3. Run `npm run create-admin` in your terminal.

import { kv } from '@vercel/kv';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import type { User } from '@/lib/db';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

// --- IMPORTANT ---
// --- Fill in your admin details here before running the script ---
const ADMIN_DETAILS = {
  name: 'Cuthbert Ndikudze',
  email: 'cutbertndikudze@gmail.com',
  password: 'Mudharaa@1', // Choose a strong password
};
// -----------------------------------------------------------------

async function createAdminUser() {
  console.log('Starting admin user creation process...');

  const { name, email, password } = ADMIN_DETAILS;

  if (!email || !password || !name) {
    console.error(
      'Error: Please fill in the name, email, and password in the ADMIN_DETAILS object in this script.'
    );
    return;
  }

  try {
    // Check if user already exists
    const existingUserByEmail: User | null = await kv.get(`user:${email}`);
    if (existingUserByEmail) {
      console.log(`User with email ${email} already exists. Aborting.`);
      return;
    }

    // Hash the password
    console.log('Hashing password...');
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create the user object
    const userId = randomUUID();
    const user: User = {
      id: userId,
      name,
      email,
      password: hashedPassword,
      isAdmin: true,
      createdAt: new Date().toISOString(),
    };

    // Save to database
    console.log('Saving user to the database...');
    const pipeline = kv.pipeline();
    pipeline.set(`user:${email}`, user);
    pipeline.set(`user-by-id:${userId}`, user); // Also store by ID for easy lookup
    await pipeline.exec();

    console.log('-----------------------------------------');
    console.log('✅ Admin user created successfully!');
    console.log(`✅ Email: ${email}`);
    console.log('-----------------------------------------');
    console.log(
      'You can now log in with these credentials. You can also delete this script file now.'
    );
  } catch (error) {
    console.error('An error occurred during admin creation:', error);
  }
}

createAdminUser();
