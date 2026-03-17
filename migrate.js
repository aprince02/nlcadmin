/**
 * migrate.js
 * One-time script to copy all data from db.sqlite → PostgreSQL (Supabase).
 *
 * Usage:
 *   1. Make sure DATABASE_URL is set in your .env file
 *   2. node migrate.js
 *
 * Safe to re-run — uses INSERT ... ON CONFLICT DO NOTHING everywhere.
 */

require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');

const SQLITE_FILE = './db.sqlite';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost')
    ? { rejectUnauthorized: false }
    : false,
});

// Open SQLite (read-only)
const sqlite = new sqlite3.Database(SQLITE_FILE, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('Could not open db.sqlite:', err.message);
    process.exit(1);
  }
});

function sqliteAll(sql) {
  return new Promise((resolve, reject) => {
    sqlite.all(sql, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

async function migrateTable(name, sqliteQuery, pgInsert, rowMapper) {
  const rows = await sqliteAll(sqliteQuery);
  if (rows.length === 0) {
    console.log(`  ${name}: 0 rows (skipped)`);
    return;
  }
  let inserted = 0;
  for (const row of rows) {
    const values = rowMapper(row);
    await pool.query(pgInsert, values);
    inserted++;
  }
  console.log(`  ${name}: ${inserted} rows migrated`);
}

async function resetSequence(table, column = 'id') {
  await pool.query(
    `SELECT setval(pg_get_serial_sequence('${table}', '${column}'), COALESCE(MAX(${column}), 1)) FROM ${table}`
  );
}

async function main() {
  console.log('Starting migration from SQLite → PostgreSQL...\n');

  // ── users ─────────────────────────────────────────────────────────
  await migrateTable(
    'users',
    'SELECT * FROM user',
    `INSERT INTO users (id, name, email, password, role, security_question, approval)
     VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING`,
    r => [r.id, r.name, r.email, r.password, r.role, r.security_question, r.approval]
  );

  // ── members ───────────────────────────────────────────────────────
  await migrateTable(
    'members',
    'SELECT * FROM members',
    `INSERT INTO members (id, title, first_name, surname, sex, email, phone_number, house_number,
       address_line_1, address_line_2, city, postcode, date_of_birth, baptised, baptised_date,
       holy_spirit, native_church, children_details, emergency_contact_1, emergency_contact_1_name,
       emergency_contact_2, emergency_contact_2_name, occupation_studies, spouse_name, banking_name, is_active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)
     ON CONFLICT (id) DO NOTHING`,
    r => [r.id, r.title, r.first_name, r.surname, r.sex, r.email, r.phone_number, r.house_number,
          r.address_line_1, r.address_line_2, r.city, r.postcode, r.date_of_birth, r.baptised,
          r.baptised_date, r.holy_spirit, r.native_church, r.children_details, r.emergency_contact_1,
          r.emergency_contact_1_name, r.emergency_contact_2, r.emergency_contact_2_name,
          r.occupation_studies, r.spouse_name, r.banking_name, r.is_active]
  );

  // ── donation_types ────────────────────────────────────────────────
  await migrateTable(
    'donation_types',
    'SELECT * FROM donation_types',
    `INSERT INTO donation_types (id, type) VALUES ($1,$2) ON CONFLICT (id) DO NOTHING`,
    r => [r.id, r.type]
  );

  // ── donations ─────────────────────────────────────────────────────
  await migrateTable(
    'donations',
    'SELECT * FROM donations',
    `INSERT INTO donations (id, member_id, first_name, surname, amount, date, fund, method, gift_aid_status, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (id) DO NOTHING`,
    r => [r.id, r.member_id, r.first_name, r.surname, r.amount, r.date, r.fund, r.method, r.gift_aid_status, r.notes]
  );

  // ── transaction_types ─────────────────────────────────────────────
  await migrateTable(
    'transaction_types',
    'SELECT * FROM transaction_types',
    `INSERT INTO transaction_types (id, type) VALUES ($1,$2) ON CONFLICT (id) DO NOTHING`,
    r => [r.id, r.type]
  );

  // ── transactions ──────────────────────────────────────────────────
  await migrateTable(
    'transactions',
    'SELECT * FROM transactions',
    `INSERT INTO transactions (id, date, transaction_type, type, description, paid_out, paid_in, balance, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO NOTHING`,
    r => [r.id, r.date, r.transaction_type, r.type, r.description, r.paid_out, r.paid_in, r.balance, r.notes]
  );

  // ── offering_claim ────────────────────────────────────────────────
  await migrateTable(
    'offering_claim',
    'SELECT * FROM offering_claim',
    `INSERT INTO offering_claim (id, transaction_id, type, date, description, amount, claimed)
     VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING`,
    r => [r.id, r.transaction_id, r.type, r.date, r.description, r.amount, r.claimed]
  );

  // ── bank_connections ──────────────────────────────────────────────
  await migrateTable(
    'bank_connections',
    'SELECT * FROM bank_connections',
    `INSERT INTO bank_connections (id, account_id, account_name, account_type, account_number, sort_code,
       currency, provider_id, access_token_enc, refresh_token_enc, token_expires_at, consent_expires_at,
       last_synced_at, is_active, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) ON CONFLICT (id) DO NOTHING`,
    r => [r.id, r.account_id, r.account_name, r.account_type, r.account_number, r.sort_code,
          r.currency, r.provider_id, r.access_token_enc, r.refresh_token_enc, r.token_expires_at,
          r.consent_expires_at, r.last_synced_at, r.is_active, r.created_at]
  );

  // ── bank_balances ─────────────────────────────────────────────────
  await migrateTable(
    'bank_balances',
    'SELECT * FROM bank_balances',
    `INSERT INTO bank_balances (id, account_id, current, available, currency, recorded_at)
     VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING`,
    r => [r.id, r.account_id, r.current, r.available, r.currency, r.recorded_at]
  );

  // ── bank_transactions ─────────────────────────────────────────────
  await migrateTable(
    'bank_transactions',
    'SELECT * FROM bank_transactions',
    `INSERT INTO bank_transactions (id, account_id, provider_transaction_id, date, description, amount,
       currency, transaction_type, merchant_name, category, status, raw_payload, imported_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT (id) DO NOTHING`,
    r => [r.id, r.account_id, r.provider_transaction_id, r.date, r.description, r.amount,
          r.currency, r.transaction_type, r.merchant_name, r.category, r.status, r.raw_payload, r.imported_at]
  );

  // ── bank_sync_log ─────────────────────────────────────────────────
  await migrateTable(
    'bank_sync_log',
    'SELECT * FROM bank_sync_log',
    `INSERT INTO bank_sync_log (id, account_id, sync_type, status, records_fetched, records_inserted, error_message, synced_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,
    r => [r.id, r.account_id, r.sync_type, r.status, r.records_fetched, r.records_inserted, r.error_message, r.synced_at]
  );

  // ── console_logs ──────────────────────────────────────────────────
  await migrateTable(
    'console_logs',
    'SELECT * FROM console_logs',
    `INSERT INTO console_logs (id, timestamp, "user", log_message) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING`,
    r => [r.id, r.timestamp, r.user, r.log_message]
  );

  // ── last_update ───────────────────────────────────────────────────
  await migrateTable(
    'last_update',
    'SELECT * FROM last_update',
    `INSERT INTO last_update (id, timestamp, "user") VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING`,
    r => [r.id, r.timestamp, r.user]
  );

  // ── reset sequences so new inserts get correct IDs ────────────────
  console.log('\nResetting PostgreSQL sequences...');
  const tables = ['users', 'members', 'donation_types', 'donations', 'transaction_types',
                  'transactions', 'offering_claim', 'bank_connections', 'bank_balances',
                  'bank_transactions', 'bank_sync_log', 'console_logs', 'last_update'];
  for (const t of tables) {
    await resetSequence(t);
  }
  console.log('  Sequences reset.');

  console.log('\nMigration complete!');
}

main()
  .catch(err => {
    console.error('\nMigration failed:', err.message);
    process.exit(1);
  })
  .finally(() => {
    sqlite.close();
    pool.end();
  });
