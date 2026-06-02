import { evolutionApiService } from '../src/services/evolution-api.service';
import { db } from '../src/lib/db';
import { connections } from '../src/lib/db/schema';
import * as dotenv from 'dotenv';
process.env.DATABASE_URL = "postgresql://neondb_owner:npg_3A4aphDSoLUZ@ep-broad-truth-afj172ni.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require";
dotenv.config({ path: '.env.local', override: true });

async function run() {
  const allConnections = await db.select().from(connections).where(connections.config_name.equals('Deivid Rodrigues'));
  const s = allConnections[0];
  
  const allInstances = await evolutionApiService.fetchAllInstances();
  const instanceData = allInstances.find((i: any) => i.name === s.id || i.instance?.instanceName === s.id);
  
  console.log("Session ID:", s.id);
  console.log("Instance Found:", !!instanceData);
  if (instanceData) {
    console.log("Instance Name:", instanceData.name);
    console.log("Connection Status:", instanceData.connectionStatus);
  }
}

run();
