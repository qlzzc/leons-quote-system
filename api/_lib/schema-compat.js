const { supabase } = require('./supabase');

const supportCache = new Map();

function getCacheKey(table, column) {
  return `${table}.${column}`;
}

function isMissingColumnError(error, table, column) {
  if (!error) return false;
  const haystack = [error.message, error.details, error.hint].filter(Boolean).join(' ');
  if (error.code === 'PGRST204') {
    return haystack.includes(`'${column}'`) && haystack.includes(`'${table}'`);
  }
  if (error.code === '42703') {
    return haystack.toLowerCase().includes(`column ${table.toLowerCase()}.${column.toLowerCase()} does not exist`)
      || haystack.toLowerCase().includes(`column "${column.toLowerCase()}" does not exist`);
  }
  return false;
}

async function supportsColumn(table, column) {
  const cacheKey = getCacheKey(table, column);
  if (supportCache.has(cacheKey)) return supportCache.get(cacheKey);

  const { error } = await supabase.from(table).select(column).limit(1);
  if (!error) {
    supportCache.set(cacheKey, true);
    return true;
  }
  if (isMissingColumnError(error, table, column)) {
    supportCache.set(cacheKey, false);
    return false;
  }
  throw error;
}

function describeSchemaError(error) {
  if (!error) return '';
  if (error.code === 'PGRST204' || error.code === '42703') {
    return 'The local Supabase schema is missing a column expected by this portal build. Apply the latest schema migration or use the backward-compatible table shape.';
  }
  return '';
}

function buildSchemaErrorPayload(error) {
  const message = describeSchemaError(error);
  if (!message) return null;
  return {
    error: message,
    code: 'SCHEMA_MISMATCH',
    details: {
      sourceCode: error.code || null,
      sourceMessage: error.message || null,
    },
  };
}

module.exports = {
  buildSchemaErrorPayload,
  describeSchemaError,
  isMissingColumnError,
  supportsColumn,
};
