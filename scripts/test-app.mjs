// Test end-to-end de la app MVP2
const BASE = 'http://localhost:3000';

async function test() {
  console.log('=== TEST MVP2 APP ===\n');

  // 1. Test login page loads
  console.log('1. Login page...');
  const loginRes = await fetch(`${BASE}/login`);
  const loginHtml = await loginRes.text();
  const hasLoginForm = loginHtml.includes('Iniciar Sesion') && loginHtml.includes('Entrar');
  console.log(`   Status: ${loginRes.status} | Has form: ${hasLoginForm} ${hasLoginForm ? '✅' : '❌'}`);

  // 2. Test root redirect (should redirect to /login since no auth)
  console.log('2. Root redirect...');
  const rootRes = await fetch(`${BASE}/`, { redirect: 'manual' });
  const rootLocation = rootRes.headers.get('location');
  const rootRedirects = rootRes.status === 307 && rootLocation?.includes('/login');
  console.log(`   Status: ${rootRes.status} | Redirects to login: ${rootRedirects} ${rootRedirects ? '✅' : '❌'}`);

  // 3. Test protected routes redirect to login
  console.log('3. Protected routes redirect...');
  const adminRes = await fetch(`${BASE}/admin`, { redirect: 'manual' });
  const adminRedirects = adminRes.status === 307;
  console.log(`   /admin Status: ${adminRes.status} | Redirects: ${adminRedirects} ${adminRedirects ? '✅' : '❌'}`);

  const uploadRes = await fetch(`${BASE}/upload`, { redirect: 'manual' });
  const uploadRedirects = uploadRes.status === 307;
  console.log(`   /upload Status: ${uploadRes.status} | Redirects: ${uploadRedirects} ${uploadRedirects ? '✅' : '❌'}`);

  const dashRes = await fetch(`${BASE}/dashboard`, { redirect: 'manual' });
  const dashRedirects = dashRes.status === 307;
  console.log(`   /dashboard Status: ${dashRes.status} | Redirects: ${dashRedirects} ${dashRedirects ? '✅' : '❌'}`);

  // 4. Test API requires auth
  console.log('4. API auth check...');
  const apiRes = await fetch(`${BASE}/api/upload-excel`, {
    method: 'POST',
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  const apiJson = await apiRes.json().catch(() => ({}));
  console.log(`   Status: ${apiRes.status} | Response: ${JSON.stringify(apiJson).substring(0, 80)} ${apiRes.status === 401 ? '✅' : '❌'}`);

  // 5. Test login page branding
  console.log('5. Branding check...');
  const hasRowell = loginHtml.includes('Rowell');
  const hasPatrimonios = loginHtml.includes('Patrimonios');
  const hasNavyColor = loginHtml.includes('rowell-navy');
  const hasGoldColor = loginHtml.includes('rowell-gold');
  const hasFont = loginHtml.includes('font-display');
  console.log(`   Rowell: ${hasRowell} | Patrimonios: ${hasPatrimonios} | Navy: ${hasNavyColor} | Gold: ${hasGoldColor} | Font: ${hasFont} ${hasRowell && hasPatrimonios && hasNavyColor ? '✅' : '❌'}`);

  // 6. Test static assets
  console.log('6. Static assets...');
  const cssRes = await fetch(`${BASE}/_next/static/css/app/layout.css`);
  const cssOk = cssRes.status === 200;
  console.log(`   CSS: ${cssRes.status} ${cssOk ? '✅' : '❌'}`);

  console.log('\n=== TESTS COMPLETE ===');
}

test().catch(console.error);
