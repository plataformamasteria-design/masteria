import * as fs from 'fs';
const envFile = fs.readFileSync('.env.local', 'utf8');
const dbUrl = envFile.split('\n').find(l => l.startsWith('DATABASE_URL='))?.split('=')[1];
if (dbUrl) process.env.DATABASE_URL = dbUrl.trim().replace(/^"|"$/g, '');

import { db } from './src/lib/db/index.js';
import { automationFlows } from './src/lib/db/schema.js';
import { eq, ilike } from 'drizzle-orm';

async function main() {
  const flows = await db.select().from(automationFlows).where(ilike(automationFlows.name, '%Douglas%'));
  if (flows.length === 0) {
    console.log("No flow found with name Douglas.");
  } else {
    for (const flow of flows) {
      console.log(`ID: ${flow.id}, Name: ${flow.name}, CompanyId: ${flow.companyId}`);
      console.log(`VisualData keys:`, Object.keys(flow.visualData || {}));
      const nodes = (flow.visualData as any)?.nodes || [];
      const edges = (flow.visualData as any)?.edges || [];
      console.log(`Nodes count: ${nodes.length}, Edges count: ${edges.length}`);
      
      // Check validation
      import('zod').then(({ z }) => {
        const FlowVisualSchema = z.object({
            nodes: z.array(z.object({
                id: z.string(),
                type: z.string().optional(),
                position: z.object({ x: z.number(), y: z.number() }).optional(),
                data: z.any()
            })).min(1, 'Automação precisa de pelo menos 1 nó (Trigger).'),
            edges: z.array(z.object({
                id: z.string(),
                source: z.string(),
                target: z.string()
            })).optional().default([]),
        });
        
        try {
            FlowVisualSchema.parse(flow.visualData);
            console.log("Zod validation PASSED!");
        } catch (err) {
            console.log("Zod validation FAILED:", err.issues);
        }
      });
    }
  }
  setTimeout(() => process.exit(0), 1000);
}

main().catch(console.error);
