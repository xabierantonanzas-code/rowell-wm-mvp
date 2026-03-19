import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://vnxmtjzzrbnmmmqhyhpv.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZueG10anp6cmJubW1tcWh5aHB2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTU5NzIxOSwiZXhwIjoyMDg3MTczMjE5fQ.nid55WrlAQ58qFqaav4lcKdy6nMoiCgQ73cAb8InbeA'
);

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
    password: 'Mvp2rowell'
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
