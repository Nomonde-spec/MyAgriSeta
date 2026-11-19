const { Pool } = require('pg');

const tables = {
  users: { name: 'users', key: (record) => record.id },
  services: { name: 'services', key: (record) => record.id },
  learningCategories: { name: 'learning_categories', key: (record) => record.id },
  trainingProviders: { name: 'training_providers', key: (record) => record.id },
  learningCourses: { name: 'learning_courses', key: (record) => record.id },
  learningProgrammes: { name: 'learning_programmes', key: (record) => record.id },
  learningResources: { name: 'learning_resources', key: (record) => record.id },
  farmerMarketRecords: { name: 'farmer_market_records', key: (record) => record.id },
  farmerMentors: { name: 'farmer_mentors', key: (record) => record.id },
  farmerMentorRequests: { name: 'farmer_mentor_requests', key: (record) => record.id },
  enrollments: { name: 'enrollments', key: (record) => record.id },
  resourceProgress: {
    name: 'resource_progress',
    key: (record) => JSON.stringify([record.userId, record.resourceId]),
  },
  savedCourses: { name: 'saved_courses', key: (record) => JSON.stringify([record.userId, record.courseId]) },
  courseProgress: { name: 'course_progress', key: (record) => record.id },
  moduleProgress: { name: 'learning_module_progress', key: (record) => record.id },
  certificates: { name: 'certificates', key: (record) => record.id },
  passportSkills: { name: 'passport_skills', key: (record) => record.id },
  passportRecords: { name: 'passport_records', key: (record) => record.id },
  opportunities: { name: 'opportunities', key: (record) => record.id },
  savedOpportunities: {
    name: 'saved_opportunities',
    key: (record) => JSON.stringify([record.userId, record.opportunityId]),
  },
  notifications: { name: 'notifications', key: (record) => record.id },
  applications: { name: 'applications', key: (record) => record.id },
  auditLogs: { name: 'audit_logs', key: (record) => record.id },
  sdfWorkforceRecords: { name: 'sdf_workforce_records', key: (record) => record.id },
  smmeBusinessProfiles: { name: 'smme_business_profiles', key: (record) => record.id },
  smmeSupportRequests: { name: 'smme_support_requests', key: (record) => record.id },
  assessorProfiles: { name: 'assessor_profiles', key: (record) => record.id },
  assessorAssignments: { name: 'assessor_assignments', key: (record) => record.id },
};

let pool;
let initialized = false;
let connected = false;

function getSecureConnectionString(connectionString) {
  return connectionString.replace(/([?&])sslmode=[^&]*/i, '$1sslmode=verify-full');
}

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: getSecureConnectionString(process.env.DATABASE_URL),
      ssl: { rejectUnauthorized: true },
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
      max: 5,
    });
    pool.on('error', () => {
      connected = false;
      console.error('Neon PostgreSQL connection error.');
    });
  }
  return pool;
}

function getTable(collection) {
  const table = tables[collection];
  if (!table) throw new Error(`Unknown database collection "${collection}".`);
  return table;
}

function getRecordKey(collection, record) {
  const key = getTable(collection).key(record);
  if (typeof key !== 'string' || key.length === 0) {
    throw new Error(`Database record for "${collection}" is missing its key fields.`);
  }
  return key;
}

async function createTables(client) {
  // All CREATE TABLE statements are independent, so they are sent as one
  // multi-statement query (Postgres' simple query protocol runs them in a
  // single round trip) instead of one round trip per table.
  const tableStatements = Object.values(tables)
    .map(
      ({ name }) => `CREATE TABLE IF NOT EXISTS ${name} (
        record_key text PRIMARY KEY,
        data jsonb NOT NULL CHECK (jsonb_typeof(data) = 'object')
      );`
    )
    .join('\n');
  await client.query(`${tableStatements}
    CREATE TABLE IF NOT EXISTS revoked_tokens (
      token_hash text PRIMARY KEY,
      expires_at timestamptz NOT NULL
    );
  `);

  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS agri_users_email_unique ON users (lower(data->>'email'));
    CREATE UNIQUE INDEX IF NOT EXISTS agri_users_username_unique ON users (lower(data->>'username'));
    CREATE UNIQUE INDEX IF NOT EXISTS agri_users_phone_unique
      ON users ((nullif(btrim(data->>'phone'), '')))
      WHERE nullif(btrim(data->>'phone'), '') IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS agri_users_role_verification_key_unique
      ON users ((data->>'roleVerificationKey'))
      WHERE data->>'roleVerificationKey' IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS agri_enrollments_reference_unique ON enrollments ((data->>'reference'));
    CREATE UNIQUE INDEX IF NOT EXISTS agri_enrollments_active_applicant_course_unique
      ON enrollments ((data->>'applicantId'), (data->>'courseId'))
      WHERE data->>'active' = 'true';
    CREATE UNIQUE INDEX IF NOT EXISTS agri_applications_reference_unique ON applications ((data->>'reference'));
    CREATE INDEX IF NOT EXISTS agri_revoked_tokens_expires_at ON revoked_tokens (expires_at);
  `);
}

async function insertRecord(client, collection, record) {
  const { name } = getTable(collection);
  const key = getRecordKey(collection, record);
  await client.query(
    `INSERT INTO ${name} (record_key, data) VALUES ($1, $2::jsonb) ON CONFLICT (record_key) DO NOTHING`,
    [key, JSON.stringify(record)]
  );
}

const INSERT_BATCH_SIZE = 500;

// Inserts every seed record for a collection in as few round trips as
// possible: one multi-row INSERT per batch instead of one INSERT per record.
async function insertManyRecords(client, collection, records) {
  if (!records.length) return;
  const { name } = getTable(collection);
  for (let start = 0; start < records.length; start += INSERT_BATCH_SIZE) {
    const batch = records.slice(start, start + INSERT_BATCH_SIZE);
    const params = [];
    const rows = batch.map((record) => {
      const key = getRecordKey(collection, record);
      params.push(key, JSON.stringify(record));
      return `($${params.length - 1}, $${params.length}::jsonb)`;
    });
    await client.query(
      `INSERT INTO ${name} (record_key, data) VALUES ${rows.join(',')} ON CONFLICT (record_key) DO NOTHING`,
      params
    );
  }
}

async function updateRecord(client, collection, record) {
  const { name } = getTable(collection);
  const key = getRecordKey(collection, record);
  await client.query(
    `INSERT INTO ${name} (record_key, data) VALUES ($1, $2::jsonb)
     ON CONFLICT (record_key) DO UPDATE SET data = EXCLUDED.data`,
    [key, JSON.stringify(record)]
  );
}

async function connectAndLoad(collections) {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL must be configured; this application uses Neon PostgreSQL only.');
  }
  if (!/^postgres(?:ql)?:\/\//i.test(connectionString)) {
    throw new Error('DATABASE_URL must be a PostgreSQL connection string for Neon.');
  }
  let parsedConnectionString;
  try {
    parsedConnectionString = new URL(connectionString);
  } catch {
    throw new Error('DATABASE_URL must be a valid Neon PostgreSQL connection string.');
  }
  if (!parsedConnectionString.hostname.endsWith('.neon.tech')) {
    throw new Error('DATABASE_URL must point to a Neon PostgreSQL endpoint.');
  }

  const clientPool = getPool();
  const client = await clientPool.connect();
  connected = false;
  let startupStep = 'creating tables and indexes';

  try {
    await client.query('BEGIN');
    await createTables(client);

    for (const collection of Object.keys(tables)) {
      startupStep = `seeding and loading "${collection}"`;
      const seed = collections[collection];
      if (!Array.isArray(seed)) {
        throw new Error(`Missing seed records for database collection "${collection}".`);
      }
      await insertManyRecords(client, collection, seed);
      const { name } = getTable(collection);
      const result = await client.query(`SELECT data FROM ${name}`);
      collections[collection].splice(0, collections[collection].length, ...result.rows.map((row) => row.data));
    }

    const legacyRegistrationEvents = collections.auditLogs.filter((entry) =>
      typeof entry.action === 'string' && entry.action.startsWith('Self-registered ')
    );
    startupStep = 'checking legacy user accounts';
    for (const user of collections.users) {
      const registrationEvent = legacyRegistrationEvents.find((entry) =>
        typeof entry.user === 'string' && entry.user.toLowerCase() === user.email.toLowerCase()
      );
      if (
        registrationEvent &&
        user.roleVerificationStatus === undefined &&
        user.roles.some((role) => ['learner', 'farmer', 'employer', 'sdf', 'training_provider'].includes(role))
      ) {
        user.status = 'inactive';
        user.roleVerificationStatus = 'pending';
        user.roleVerificationDetails = null;
        user.roleVerificationSubmittedAt = registrationEvent.timestamp || new Date().toISOString();
        await updateRecord(client, 'users', user);

        const migrationEvent = {
          id: `audit-role-verification-migration-${user.id}`,
          user: 'system',
          action: `Moved legacy self-registered account ${user.email} to manual role verification`,
          timestamp: new Date().toISOString(),
        };
        const { name } = getTable('auditLogs');
        const key = getRecordKey('auditLogs', migrationEvent);
        const result = await client.query(
          `INSERT INTO ${name} (record_key, data) VALUES ($1, $2::jsonb)
           ON CONFLICT (record_key) DO NOTHING RETURNING data`,
          [key, JSON.stringify(migrationEvent)]
        );
        if (result.rowCount > 0) collections.auditLogs.push(migrationEvent);
      }
    }

    await client.query('COMMIT');
    initialized = true;
    connected = true;
    return true;
  } catch (error) {
    connected = false;
    console.error(
      `Neon PostgreSQL startup failed during ${startupStep} (${error.name || 'Error'}${error.code ? `, ${error.code}` : ''}).`
    );
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error(`Neon PostgreSQL transaction rollback failed (${rollbackError.name || 'Error'}).`);
    }
    throw error;
  } finally {
    client.release();
  }
}

async function persistRecord(collection, record) {
  if (!initialized) return;
  try {
    await updateRecord(getPool(), collection, record);
    connected = true;
  } catch (error) {
    connected = false;
    throw error;
  }
}

async function removeRecord(collection, filter) {
  if (!initialized) return;
  const { name } = getTable(collection);
  if (!filter || typeof filter !== 'object' || Object.keys(filter).length === 0) {
    throw new Error('A database removal filter is required.');
  }
  try {
    await getPool().query(`DELETE FROM ${name} WHERE data @> $1::jsonb`, [JSON.stringify(filter)]);
    connected = true;
  } catch (error) {
    connected = false;
    throw error;
  }
}

function isDatabaseConnected() {
  return connected;
}

// Logged-out tokens are kept in memory for fast per-request checks, but are
// also persisted here so a server restart does not silently un-revoke every
// session. Only the sha256 hash of the token is stored, never the token
// itself.
async function persistRevokedToken(tokenHash, expiresAt) {
  if (!initialized) return;
  try {
    await getPool().query(
      'INSERT INTO revoked_tokens (token_hash, expires_at) VALUES ($1, $2) ON CONFLICT (token_hash) DO NOTHING',
      [tokenHash, expiresAt]
    );
    connected = true;
  } catch (error) {
    connected = false;
    console.error(`Revoked token could not be persisted (${error.code || error.name || 'database error'}).`);
    throw error;
  }
}

// Called once at startup to repopulate the in-memory revocation set from
// Neon, and to prune hashes for tokens that have already expired on their
// own (so the table does not grow forever).
async function loadActiveRevokedTokenHashes() {
  if (!initialized) return [];
  const pool = getPool();
  await pool.query('DELETE FROM revoked_tokens WHERE expires_at <= now()');
  const result = await pool.query('SELECT token_hash FROM revoked_tokens');
  return result.rows.map((row) => row.token_hash);
}

module.exports = {
  connectAndLoad,
  isDatabaseConnected,
  persistRecord,
  removeRecord,
  persistRevokedToken,
  loadActiveRevokedTokenHashes,
};
