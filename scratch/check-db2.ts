import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { db } from '@/lib/db';
import { automationFlows } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

async function check() {
  const flow = await db.query.automationFlows.findFirst({
    where: eq(automationFlows.id, '8a11daba-6795-43f5-8c72-cdb59ec6f11e')
  });

  if (!flow) {
    console.log('Flow not found');
    return;
  }

  const data: any = typeof flow.visualData === 'string' ? JSON.parse(flow.visualData) : flow.visualData;
  const nodes = data?.nodes || [];
  const aiNode = nodes.find((n: any) => n.type === 'ai' || n.type === 'ai_agent');
  console.log('AI NODE LEARNING NOTES:', aiNode?.data?.learning_notes);
  console.log('AI NODE CONFIG LEARNING NOTES:', aiNode?.data?.config?.learning_notes);
  process.exit(0);
}

check().catch(console.error);
