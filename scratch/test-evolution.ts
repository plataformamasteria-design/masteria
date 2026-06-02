import { evolutionApiService } from '../src/services/evolution-api.service';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function test() {
  const instances = await evolutionApiService.fetchAllInstances();
  console.log(JSON.stringify(instances, null, 2));
}

test();
