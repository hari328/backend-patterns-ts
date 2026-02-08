import pg from 'pg';
const { Client } = pg;

export const handler = async (event) => {
  const {
    host,
    port,
    database,
    masterUser,
    masterPassword,
    readwriteUser,
    readwritePassword,
    readonlyUser,
    readonlyPassword,
  } = event;

  const client = new Client({
    host,
    port,
    database,
    user: masterUser,
    password: masterPassword,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  try {
    await client.connect();
    console.log(`Connected to ${host}:${port}/${database}`);

    // Create readwrite role (idempotent)
    await createRoleIfNotExists(client, readwriteUser, readwritePassword);
    await client.query(`GRANT ALL PRIVILEGES ON DATABASE ${database} TO ${readwriteUser}`);
    await client.query(`GRANT ALL ON SCHEMA public TO ${readwriteUser}`);
    await client.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${readwriteUser}`);
    await client.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ${readwriteUser}`);
    console.log(`Role "${readwriteUser}" configured with read-write access`);

    // Create readonly role (idempotent)
    await createRoleIfNotExists(client, readonlyUser, readonlyPassword);
    await client.query(`GRANT CONNECT ON DATABASE ${database} TO ${readonlyUser}`);
    await client.query(`GRANT USAGE ON SCHEMA public TO ${readonlyUser}`);
    await client.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO ${readonlyUser}`);
    console.log(`Role "${readonlyUser}" configured with read-only access`);

    return { statusCode: 200, body: 'Database roles created successfully' };
  } catch (error) {
    console.error('Failed to bootstrap database roles:', error.message);
    throw error;
  } finally {
    await client.end();
  }
};

async function createRoleIfNotExists(client, roleName, password) {
  const result = await client.query(
    `SELECT 1 FROM pg_roles WHERE rolname = $1`,
    [roleName]
  );

  if (result.rows.length === 0) {
    const escapedPassword = password.replace(/'/g, "''");
    await client.query(`CREATE ROLE ${roleName} WITH LOGIN PASSWORD '${escapedPassword}'`);
    console.log(`Created role "${roleName}"`);
  } else {
    const escapedPassword = password.replace(/'/g, "''");
    await client.query(`ALTER ROLE ${roleName} WITH PASSWORD '${escapedPassword}'`);
    console.log(`Role "${roleName}" already exists — password updated`);
  }
}

