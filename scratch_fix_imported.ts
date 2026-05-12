import { db } from './src/lib/db';
import { automationFlows } from './src/lib/db/schema';
import { eq } from 'drizzle-orm';

async function run() {
  try {
    const flow = await db.query.automationFlows.findFirst({ where: eq(automationFlows.id, '4089f957-acf9-4a2d-99fc-1bc1b4376cf2') });
    if (!flow) return console.log('not found');
    
    let logic = flow.executionLogic as any;
    if (logic && Array.isArray(logic)) {
        logic = logic.map(node => {
            if (node.type === 'trigger') {
                const newData = { ...node.data };
                delete newData.filter_connection; // Remove to trigger for all connections
                delete newData.keyword; // Remove to trigger for all messages
                delete newData.match_mode;
                return { ...node, data: newData };
            }
            return node;
        });
    }

    await db.update(automationFlows)
        .set({ executionLogic: logic, isActive: true }) // Activate it!
        .where(eq(automationFlows.id, '4089f957-acf9-4a2d-99fc-1bc1b4376cf2'));

    console.log('updated imported flow!');
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

run();
