
import { db } from '../src/lib/db';
import { connections } from '../src/lib/db/schema';
import { eq, like, or } from 'drizzle-orm';

async function checkConnection() {
  const searchTerm = process.argv[2];
  if (!searchTerm) {
    console.error('Please provide a Phone ID or search term');
    process.exit(1);
  }

  console.log(`Searching for connection with term: ${searchTerm}`);

  const foundConnections = await db
    .select()
    .from(connections)
    .where(
      or(
        eq(connections.phoneNumberId, searchTerm),
        like(connections.config_name, `%${searchTerm}%`),
        like(connections.phone, `%${searchTerm}%`)
      )
    );

  if (foundConnections.length === 0) {
    console.log('No connections found.');
  } else {
    foundConnections.forEach((conn) => {
      console.log('------------------------------------------------');
      console.log(`ID: ${conn.id}`);
      console.log(`Name: ${conn.config_name}`);
      console.log(`Status: ${conn.status}`);
      console.log(`Type: ${conn.connectionType}`);
      console.log(`Phone ID: ${conn.phoneNumberId}`);
      console.log(`WABA ID: ${conn.wabaId}`);
      console.log(`Phone Number: ${conn.phone}`);
      console.log(`Is Active: ${conn.isActive}`);
      console.log(`Created At: ${conn.createdAt}`);
      console.log(`Environment: ${conn.environment}`);
      console.log(`Token Type: ${conn.tokenType}`);
      console.log(`Token Expires At: ${conn.tokenExpiresAt}`);
      console.log(`Token Error: ${conn.tokenRefreshError}`);
    });
  }
  process.exit(0);
}

checkConnection().catch((err) => {
  console.error(err);
  process.exit(1);
});
