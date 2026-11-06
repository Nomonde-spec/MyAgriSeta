const assert = require('node:assert/strict');
const { test } = require('node:test');

const { connectAndLoad, isDatabaseConnected } = require('../src/database');

test('database startup requires Neon configuration in every environment', async () => {
  const previousUri = process.env.DATABASE_URL;
  const previousEnvironment = process.env.NODE_ENV;
  delete process.env.DATABASE_URL;

  try {
    for (const environment of ['development', 'test', 'production']) {
      process.env.NODE_ENV = environment;
      await assert.rejects(connectAndLoad({}), /Neon PostgreSQL only/);
    }
    assert.equal(isDatabaseConnected(), false);
  } finally {
    if (previousUri === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousUri;
    if (previousEnvironment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousEnvironment;
  }
});

test('non-Neon database URLs are rejected', async () => {
  const previousUri = process.env.DATABASE_URL;
  const previousEnvironment = process.env.NODE_ENV;
  process.env.DATABASE_URL = 'postgresql://user:password@localhost/myagriseta';
  process.env.NODE_ENV = 'development';

  try {
    await assert.rejects(connectAndLoad({}), /Neon PostgreSQL endpoint/);
  } finally {
    if (previousUri === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousUri;
    if (previousEnvironment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousEnvironment;
  }
});
