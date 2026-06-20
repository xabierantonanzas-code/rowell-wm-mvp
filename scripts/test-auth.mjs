import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Credenciales solo desde .env.local (nunca hardcodeadas).
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  for (const l of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = l.match(/^([A-Z_]+)=(.*)$/);
    if (m) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env.local');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function test() {
  // Check if user exists and has admin role
  const { data: users, error } = await supabase.auth.admin.listUsers();
  if (error) { console.log('ERROR:', error.message); return; }

  const edgard = users.users.find(u => u.email === 'e.font@rowellpatrimonios.com');
  if (!edgard) { console.log('USER NOT FOUND'); return; }

  console.log('User found:', edgard.email);
  console.log('Role:', edgard.app_metadata?.role || 'NO ROLE');
  console.log('Confirmed:', edgard.email_confirmed_at ? 'YES' : 'NO');

  // If no admin role, set it
  if (edgard.app_metadata?.role !== 'admin') {
    console.log('Setting admin role...');
    const { error: updateError } = await supabase.auth.admin.updateUserById(edgard.id, {
      app_metadata: { role: 'admin' }
    });
    if (updateError) console.log('Update error:', updateError.message);
    else console.log('Admin role SET!');
  }

  // Test login
  const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
    email: 'e.font@rowellpatrimonios.com',
    password: process.env.TEST_USER_PASSWORD ?? ''
  });
  if (loginError) console.log('LOGIN ERROR:', loginError.message);
  else console.log('LOGIN OK! Token exists:', !!loginData.session?.access_token);

  // Check tables exist
  const { data: tables, error: tablesError } = await supabase
    .from('accounts')
    .select('id')
    .limit(1);

  if (tablesError) console.log('TABLES ERROR:', tablesError.message);
  else console.log('Tables OK, accounts count check:', tables.length);
}

test();
