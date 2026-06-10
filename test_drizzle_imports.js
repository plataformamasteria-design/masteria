const { db } = require('./src/lib/db');
const schema = require('./src/lib/db/schema');
console.log("DB keys:", Object.keys(schema).filter(k => !k.endsWith('Relations')));
