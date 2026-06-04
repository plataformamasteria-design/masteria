import 'dotenv/config';
import { processPendingCampaigns } from '../src/services/campaign-processing.service';

async function run() {
  console.log("Checking pending campaigns...");
  const result = await processPendingCampaigns();
  console.log("Result:", result);
  process.exit(0);
}

run();
