const fs = require('fs');
const path = require('path');
const seed = require('./seed-data');

const useMemoryOnly = process.env.KALYANA_USE_MEMORY_DB === '1' || Boolean(process.env.VERCEL);
const dataDir = path.join(__dirname, '..', 'data');
const dataFile = path.join(dataDir, 'kalyana-db.json');

function clone(value) {
  return structuredClone(value);
}

function loadInitial() {
  if (useMemoryOnly) return clone(seed);
  try {
    if (fs.existsSync(dataFile)) {
      const parsed = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
      return {...clone(seed), ...parsed};
    }
  } catch (error) {
    console.warn('Kalyana: database lokal gagal dibaca, memakai seed.', error.message);
  }
  return clone(seed);
}

const memory = loadInitial();

function persist() {
  if (useMemoryOnly) return;
  fs.mkdirSync(dataDir, {recursive:true});
  const temp = dataFile + '.tmp';
  fs.writeFileSync(temp, JSON.stringify(memory, null, 2));
  fs.renameSync(temp, dataFile);
}

async function health() { return true; }
async function list(collection) { return clone(memory[collection] || []); }
async function get(collection, id) { return clone((memory[collection] || []).find((item) => item.id === id) || null); }
async function findOne(collection, field, value) { return clone((memory[collection] || []).find((item) => item[field] === value) || null); }

async function create(collection, record) {
  memory[collection] ??= [];
  memory[collection].push(clone(record));
  persist();
  return clone(record);
}

async function update(collection, id, patch) {
  const items = memory[collection] || [];
  const index = items.findIndex((item) => item.id === id);
  if (index < 0) return null;
  items[index] = {...items[index], ...clone(patch)};
  persist();
  return clone(items[index]);
}

async function remove(collection, id) {
  const items = memory[collection] || [];
  const index = items.findIndex((item) => item.id === id);
  if (index < 0) return null;
  const [removed] = items.splice(index, 1);
  persist();
  return clone(removed);
}

module.exports = {health, list, get, findOne, create, update, remove};
