import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://vnxmtjzzrbnmmmqhyhpv.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZueG10anp6cmJubW1tcWh5aHB2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTU5NzIxOSwiZXhwIjoyMDg3MTczMjE5fQ.nid55WrlAQ58qFqaav4lcKdy6nMoiCgQ73cAb8InbeA'
);

async function seed() {
  console.log('=== SEEDING DATA ===');

  // 1. Create 5 clients
  const clients = [
    { full_name: 'Carlos Martinez Garcia', email: 'carlos.martinez@email.com', phone: '+34 612 345 678', notes: 'Cliente preferente desde 2019' },
    { full_name: 'Ana Lopez Fernandez', email: 'ana.lopez@email.com', phone: '+34 623 456 789', notes: 'Perfil conservador' },
    { full_name: 'Roberto Sanchez Ruiz', email: 'roberto.sanchez@email.com', phone: '+34 634 567 890', notes: 'Perfil moderado, interes en ESG' },
    { full_name: 'Maria Torres Blanco', email: 'maria.torres@email.com', phone: '+34 645 678 901', notes: 'Perfil agresivo, alta tolerancia al riesgo' },
    { full_name: 'Javier Diaz Moreno', email: 'javier.diaz@email.com', phone: '+34 656 789 012', notes: 'Empresario, diversificacion internacional' },
  ];

  const { data: insertedClients, error: clientsError } = await supabase
    .from('clients')
    .insert(clients)
    .select();

  if (clientsError) { console.log('Clients error:', clientsError.message); return; }
  console.log(`Inserted ${insertedClients.length} clients`);

  // 2. Create accounts (2 per client = 10 accounts)
  const accountsData = [];
  const accountNumbers = [
    '0049-0001-5123456789', '0049-0001-5123456790',
    '0049-0002-5234567891', '0049-0002-5234567892',
    '0049-0003-5345678901', '0049-0003-5345678902',
    '0049-0004-5456789012', '0049-0004-5456789013',
    '0049-0005-5567890123', '0049-0005-5567890124',
  ];
  const labels = [
    'Cartera Principal', 'Cartera Conservadora',
    'Cartera Mixta', 'Plan Ahorro',
    'Cartera Renta Fija', 'Cartera Crecimiento',
    'Cartera Global', 'Cartera Europa',
    'Cartera Internacional', 'Cartera Tech',
  ];

  for (let i = 0; i < insertedClients.length; i++) {
    accountsData.push({
      client_id: insertedClients[i].id,
      account_number: accountNumbers[i * 2],
      label: labels[i * 2],
    });
    accountsData.push({
      client_id: insertedClients[i].id,
      account_number: accountNumbers[i * 2 + 1],
      label: labels[i * 2 + 1],
    });
  }

  const { data: insertedAccounts, error: accountsError } = await supabase
    .from('accounts')
    .insert(accountsData)
    .select();

  if (accountsError) { console.log('Accounts error:', accountsError.message); return; }
  console.log(`Inserted ${insertedAccounts.length} accounts`);

  // 3. Create positions for 3 snapshot dates
  const snapshotDates = ['2025-11-30', '2025-12-31', '2026-01-31'];
  const funds = [
    { isin: 'ES0152743003', product_name: 'Mapfre AM Renta Fija Mixta', manager: 'Mapfre AM', currency: 'EUR' },
    { isin: 'LU0996182563', product_name: 'Amundi Funds Global Equity', manager: 'Amundi', currency: 'EUR' },
    { isin: 'IE00B4L5Y983', product_name: 'iShares Core MSCI World', manager: 'BlackRock', currency: 'EUR' },
    { isin: 'LU0629459743', product_name: 'UBS ETF MSCI EMU', manager: 'UBS', currency: 'EUR' },
    { isin: 'ES0114105036', product_name: 'BBVA Renta Fija CP', manager: 'BBVA AM', currency: 'EUR' },
    { isin: 'LU0171310443', product_name: 'BGF World Technology', manager: 'BlackRock', currency: 'USD' },
    { isin: 'IE00BKM4GZ66', product_name: 'iShares Core EM IMI', manager: 'BlackRock', currency: 'EUR' },
    { isin: 'LU0048573561', product_name: 'Fidelity European Growth', manager: 'Fidelity', currency: 'EUR' },
  ];

  const positionsData = [];
  for (const account of insertedAccounts) {
    // Each account gets 3-6 random funds
    const numFunds = 3 + Math.floor(Math.random() * 4);
    const selectedFunds = funds.sort(() => 0.5 - Math.random()).slice(0, numFunds);

    for (const date of snapshotDates) {
      const dateMultiplier = date === '2025-11-30' ? 0.95 : date === '2025-12-31' ? 1.0 : 1.03;

      for (const fund of selectedFunds) {
        const units = Math.round((50 + Math.random() * 500) * 1000) / 1000;
        const avgCost = Math.round((10 + Math.random() * 90) * 100) / 100;
        const marketPrice = Math.round(avgCost * (0.85 + Math.random() * 0.35) * dateMultiplier * 100) / 100;
        const positionValue = Math.round(units * marketPrice * 100) / 100;
        const fxRate = fund.currency === 'USD' ? 1.08 + Math.random() * 0.04 : 1.0;

        positionsData.push({
          account_id: account.id,
          snapshot_date: date,
          isin: fund.isin,
          product_name: fund.product_name,
          manager: fund.manager,
          currency: fund.currency,
          units,
          avg_cost: avgCost,
          market_price: marketPrice,
          position_value: positionValue,
          fx_rate: Math.round(fxRate * 10000) / 10000,
          purchase_date: '2023-' + String(1 + Math.floor(Math.random() * 12)).padStart(2, '0') + '-15',
        });
      }
    }
  }

  // Insert in batches
  for (let i = 0; i < positionsData.length; i += 500) {
    const batch = positionsData.slice(i, i + 500);
    const { error } = await supabase.from('positions').insert(batch);
    if (error) { console.log(`Positions batch ${i} error:`, error.message); return; }
  }
  console.log(`Inserted ${positionsData.length} positions`);

  // 4. Create cash balances
  const balancesData = [];
  for (const account of insertedAccounts) {
    for (const date of snapshotDates) {
      balancesData.push({
        account_id: account.id,
        snapshot_date: date,
        cash_account_number: account.account_number + '-EF',
        currency: 'EUR',
        balance: Math.round((1000 + Math.random() * 50000) * 100) / 100,
        sign: '+',
      });
    }
  }

  const { error: balancesError } = await supabase.from('cash_balances').insert(balancesData);
  if (balancesError) { console.log('Balances error:', balancesError.message); return; }
  console.log(`Inserted ${balancesData.length} cash balances`);

  // 5. Create operations
  const operationTypes = ['COMPRA', 'VENTA', 'SUSCRIPCION', 'REEMBOLSO', 'DIVIDENDO', 'CANJE'];
  const operationsData = [];
  let opNum = 1000;

  for (const account of insertedAccounts) {
    const numOps = 5 + Math.floor(Math.random() * 15);
    const selectedFunds = funds.sort(() => 0.5 - Math.random()).slice(0, 4);

    for (let j = 0; j < numOps; j++) {
      opNum++;
      const fund = selectedFunds[Math.floor(Math.random() * selectedFunds.length)];
      const opType = operationTypes[Math.floor(Math.random() * operationTypes.length)];
      const month = 1 + Math.floor(Math.random() * 12);
      const day = 1 + Math.floor(Math.random() * 28);
      const year = Math.random() > 0.3 ? 2025 : 2024;
      const opDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const units = Math.round((10 + Math.random() * 200) * 1000) / 1000;
      const price = 10 + Math.random() * 90;
      const grossAmount = Math.round(units * price * 100) / 100;
      const commission = Math.round(grossAmount * 0.002 * 100) / 100;
      const netAmount = Math.round((grossAmount + commission) * 100) / 100;

      operationsData.push({
        account_id: account.id,
        operation_number: `OP-${String(opNum).padStart(6, '0')}`,
        operation_type: opType,
        isin: fund.isin,
        product_name: fund.product_name,
        operation_date: opDate,
        settlement_date: opDate,
        currency: fund.currency,
        units,
        gross_amount: grossAmount,
        net_amount: netAmount,
        fx_rate: fund.currency === 'USD' ? 1.09 : 1.0,
        eur_amount: netAmount,
        withholding: opType === 'DIVIDENDO' ? Math.round(grossAmount * 0.19 * 100) / 100 : 0,
        commission,
      });
    }
  }

  for (let i = 0; i < operationsData.length; i += 500) {
    const batch = operationsData.slice(i, i + 500);
    const { error } = await supabase.from('operations').insert(batch);
    if (error) { console.log(`Operations batch ${i} error:`, error.message); return; }
  }
  console.log(`Inserted ${operationsData.length} operations`);

  console.log('\n=== SEED COMPLETE ===');
  console.log(`Clients: ${insertedClients.length}`);
  console.log(`Accounts: ${insertedAccounts.length}`);
  console.log(`Positions: ${positionsData.length}`);
  console.log(`Cash Balances: ${balancesData.length}`);
  console.log(`Operations: ${operationsData.length}`);
}

seed();
