'use strict';

/**
 * Runs once before the entire integration test suite.
 * Creates the gamecollector_test database if it does not already exist.
 * Requires docker-compose (Postgres + Redis) to be running.
 */

const { Client } = require('pg');

module.exports = async function () {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'gamecollector',
    password: 'password',
    database: 'postgres',
  });

  try {
    await client.connect();
    try {
      await client.query('CREATE DATABASE gamecollector_test');
    } catch {
      /* already exists — ignore */
    }
  } finally {
    await client.end();
  }
};
