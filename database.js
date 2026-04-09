const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost')
    ? { rejectUnauthorized: false }
    : false,
});

async function initDb() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS charities (
        id         SERIAL PRIMARY KEY,
        name       TEXT NOT NULL,
        slug       TEXT UNIQUE NOT NULL,
        email      TEXT,
        phone      TEXT,
        website    TEXT,
        charity_no TEXT,
        is_active  INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id               SERIAL PRIMARY KEY,
        name             TEXT,
        email            TEXT,
        password         TEXT,
        role             TEXT,
        security_question TEXT,
        approval         TEXT,
        charity_id       INTEGER NOT NULL REFERENCES charities(id)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS members (
        id                       SERIAL PRIMARY KEY,
        title                    TEXT,
        first_name               TEXT,
        surname                  TEXT,
        sex                      TEXT,
        email                    TEXT,
        phone_number             TEXT,
        house_number             INTEGER,
        address_line_1           TEXT,
        address_line_2           TEXT,
        city                     TEXT,
        postcode                 TEXT,
        date_of_birth            DATE,
        baptised                 TEXT,
        baptised_date            DATE,
        holy_spirit              TEXT,
        native_church            TEXT,
        children_details         TEXT,
        emergency_contact_1      INTEGER,
        emergency_contact_1_name TEXT,
        emergency_contact_2      INTEGER,
        emergency_contact_2_name TEXT,
        occupation_studies       TEXT,
        spouse_name              TEXT,
        banking_name             TEXT,
        is_active                INTEGER DEFAULT 1,
        charity_id               INTEGER NOT NULL REFERENCES charities(id)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS donations (
        id              SERIAL PRIMARY KEY,
        member_id       INTEGER,
        first_name      TEXT,
        surname         TEXT,
        amount          TEXT,
        date            DATE,
        fund            TEXT,
        method          TEXT,
        gift_aid_status TEXT,
        notes           TEXT,
        transaction_id  INTEGER REFERENCES transactions(id),
        charity_id      INTEGER NOT NULL REFERENCES charities(id)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id               SERIAL PRIMARY KEY,
        date             DATE,
        transaction_type TEXT,
        type             TEXT,
        description      TEXT,
        paid_out         TEXT,
        paid_in          TEXT,
        balance          TEXT,
        notes            TEXT,
        charity_id       INTEGER NOT NULL REFERENCES charities(id)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS last_update (
        id        SERIAL PRIMARY KEY,
        timestamp TEXT,
        "user"    TEXT
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS console_logs (
        id          SERIAL PRIMARY KEY,
        timestamp   TEXT,
        "user"      TEXT,
        log_message TEXT,
        charity_id  INTEGER REFERENCES charities(id)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS transaction_types (
        id         SERIAL PRIMARY KEY,
        type       TEXT NOT NULL,
        charity_id INTEGER NOT NULL REFERENCES charities(id)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS donation_types (
        id         SERIAL PRIMARY KEY,
        type       TEXT NOT NULL,
        charity_id INTEGER NOT NULL REFERENCES charities(id)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS bank_connections (
        id                SERIAL PRIMARY KEY,
        account_id        TEXT UNIQUE NOT NULL,
        account_name      TEXT,
        account_type      TEXT,
        account_number    TEXT,
        sort_code         TEXT,
        currency          TEXT DEFAULT 'GBP',
        provider_id       TEXT,
        access_token_enc  TEXT,
        refresh_token_enc TEXT,
        token_expires_at  TEXT,
        consent_expires_at TEXT,
        last_synced_at    TEXT,
        is_active         INTEGER DEFAULT 1,
        created_at        TEXT DEFAULT NOW(),
        charity_id        INTEGER NOT NULL REFERENCES charities(id)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS bank_balances (
        id          SERIAL PRIMARY KEY,
        account_id  TEXT NOT NULL,
        current     REAL,
        available   REAL,
        currency    TEXT DEFAULT 'GBP',
        recorded_at TEXT DEFAULT NOW(),
        charity_id  INTEGER NOT NULL REFERENCES charities(id)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS bank_transactions (
        id                         SERIAL PRIMARY KEY,
        account_id                 TEXT NOT NULL,
        provider_transaction_id    TEXT UNIQUE,
        date                       TEXT,
        description                TEXT,
        amount                     REAL,
        currency                   TEXT DEFAULT 'GBP',
        transaction_type           TEXT,
        merchant_name              TEXT,
        category                   TEXT,
        status                     TEXT DEFAULT 'posted',
        raw_payload                TEXT,
        imported_at                TEXT DEFAULT NOW(),
        charity_id                 INTEGER NOT NULL REFERENCES charities(id)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS bank_sync_log (
        id               SERIAL PRIMARY KEY,
        account_id       TEXT,
        sync_type        TEXT,
        status           TEXT,
        records_fetched  INTEGER DEFAULT 0,
        records_inserted INTEGER DEFAULT 0,
        error_message    TEXT,
        synced_at        TEXT DEFAULT NOW(),
        charity_id       INTEGER NOT NULL REFERENCES charities(id)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS offering_claim (
        id             SERIAL PRIMARY KEY,
        transaction_id INTEGER UNIQUE,
        type           TEXT,
        date           DATE,
        description    TEXT,
        amount         TEXT,
        claimed        TEXT,
        charity_id     INTEGER NOT NULL REFERENCES charities(id)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS invites (
        id         SERIAL PRIMARY KEY,
        email      TEXT NOT NULL,
        charity_id INTEGER NOT NULL REFERENCES charities(id),
        role       TEXT NOT NULL DEFAULT 'user',
        token      TEXT UNIQUE NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        used       BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS terms_acceptance (
        id             SERIAL PRIMARY KEY,
        user_id        INTEGER REFERENCES users(id) ON DELETE CASCADE,
        username       TEXT NOT NULL,
        email          TEXT NOT NULL,
        terms_version  TEXT NOT NULL DEFAULT '1.0',
        ip_address     TEXT,
        accepted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        charity_id     INTEGER NOT NULL REFERENCES charities(id)
      )
    `);

    console.log('Database schema initialised.');
  } catch (err) {
    console.error('Error initialising database schema:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

initDb().catch(console.error);

module.exports = pool;
