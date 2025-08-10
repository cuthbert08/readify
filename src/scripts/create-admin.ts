import { kv } from '@vercel/kv';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import inquirer from 'inquirer';
import dotenv from 'dotenv';
import type { User } from '@/lib/db';

dotenv.config();

async function createAdmin() {
  console.log('Creating a new admin user for Readify...');

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: "Admin's full name:",
      validate: (input) => input.length >= 2 || 'Name must be at least 2 characters.',
    },
    {
      type: 'input',
      name: 'email',
      message: "Admin's email address:",
      validate: (input) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input) || 'Please enter a valid email.',
    },
    {
      type: 'input',
      name: 'username',
      message: "Admin's unique username (lowercase, numbers, '.', '_'):",
      validate: (input) => /^[a-z0-9_.]+$/.test(input) && input.length >=3 || 'Invalid username format.',
    },
    {
      type: 'password',
      name: 'password',
      message: "Admin's password:",
      mask: '*',
      validate: (input) => input.length >= 8 || 'Password must be at least 8 characters.',
    },
  ]);

  try {
    const { name, email, username, password } = answers;

    const existingUserByEmail: User | null = await kv.get(`readify:user:email:${email}`);
    if (existingUserByEmail) {
      console.error(`\nError: An account with the email "${email}" already exists.`);
      process.exit(1);
    }
    const existingUserByUsername: User | null = await kv.get(`readify:user:username:${username}`);
    if (existingUserByUsername) {
      console.error(`\nError: An account with the username "${username}" already exists.`);
      process.exit(1);
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = randomUUID();

    const newAdmin: User = {
      id: userId,
      name,
      email,
      username,
      password: hashedPassword,
      isAdmin: true,
      createdAt: new Date().toISOString(),
    };

    const pipeline = kv.pipeline();
    pipeline.set(`readify:user:email:${email}`, newAdmin);
    pipeline.set(`readify:user:username:${username}`, newAdmin);
    pipeline.set(`readify:user:id:${userId}`, newAdmin);
    await pipeline.exec();

    console.log('\n✅ Admin user created successfully!');
    console.log(`   ID: ${userId}`);
    console.log(`   Email: ${email}`);
    console.log(`   Username: ${username}`);
    console.log('\nYou can now log in with these credentials.');
  } catch (error) {
    console.error('\n❌ Failed to create admin user:');
    console.error(error);
    process.exit(1);
  }
}

createAdmin();
