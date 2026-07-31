import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { readDb } from '../server/db';

(async () => {
  try {
    console.log('start');
    const db = await readDb();
    console.log('db loaded, users count:', db.users.length);
    const email = 'juliano.lcunha@gmail.com';
    const user = db.users.find((u: any) => u.email && u.email.toLowerCase().trim() === email.toLowerCase().trim());
    if (!user) {
      console.log('Usuario nao encontrado');
      return;
    }
    console.log(JSON.stringify({ id: user.id, name: user.name, email: user.email, role: user.role, status: user.status }, null, 2));
  } catch (err) {
    console.error('Fatal:', err);
    process.exit(1);
  }
})();
