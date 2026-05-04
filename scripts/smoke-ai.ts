// scripts/smoke-ai.ts
import { runSmokeTests } from '@/ai/orchestrator';

async function main() {
  const results = await runSmokeTests({ debug: true, dryRun: false });
  console.log(JSON.stringify(results, null, 2));
}

main().catch((err) => {
  console.error('Smoke AI test failed:', err);
  process.exit(1);
});
