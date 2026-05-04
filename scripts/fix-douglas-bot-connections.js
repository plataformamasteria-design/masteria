const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    const flowId = '0e70099f-aa1a-4078-98c3-d137bdd22cb0';
    const flowRes = await pool.query("SELECT id, name, visual_data, execution_logic FROM automation_flows WHERE id = $1", [flowId]);
    const flow = flowRes.rows[0];
    
    let visual = typeof flow.visual_data === 'string' ? JSON.parse(flow.visual_data) : flow.visual_data;
    let logic = typeof flow.execution_logic === 'string' ? JSON.parse(flow.execution_logic) : flow.execution_logic;
    
    const steps = Array.isArray(logic) ? logic : (logic.steps || []);
    
    // Find trigger node in steps
    const triggerIdx = steps.findIndex(s => s.id === '1');
    if (triggerIdx !== -1) {
      const trigger = steps[triggerIdx];
      
      const targetEdges = visual.edges.filter(e => e.source === '1');
      if (targetEdges.length > 0) {
        trigger.nextSteps = targetEdges.map(e => e.target);
        trigger.connections = targetEdges.map(e => ({
          target: e.target,
          sourceHandle: e.sourceHandle || null
        }));
      } else {
        trigger.connections = [];
      }
      
      steps[triggerIdx] = trigger;
      
      const finalLogic = Array.isArray(logic) ? steps : { ...logic, steps };
      
      await pool.query(
        "UPDATE automation_flows SET execution_logic = $1, updated_at = NOW() WHERE id = $2",
        [JSON.stringify(finalLogic), flowId]
      );
      
      console.log('Successfully added "connections" array to the trigger node!');
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}
run();
