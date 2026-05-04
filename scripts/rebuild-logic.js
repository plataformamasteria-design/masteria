const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    const flowId = '0e70099f-aa1a-4078-98c3-d137bdd22cb0';
    const flowRes = await pool.query("SELECT visual_data FROM automation_flows WHERE id = $1", [flowId]);
    const flow = flowRes.rows[0];
    
    let visual = typeof flow.visual_data === 'string' ? JSON.parse(flow.visual_data) : flow.visual_data;
    const nodes = visual.nodes || [];
    const edges = visual.edges || [];
    
    const steps = nodes.map(node => {
      const sourceEdges = edges.filter(e => e.source === node.id);
      return {
        id: node.id,
        type: node.type,
        data: node.data,
        nextSteps: sourceEdges.map(e => e.target),
        connections: sourceEdges.map(e => ({
          target: e.target,
          sourceHandle: e.sourceHandle || null
        }))
      };
    });
    
    const finalLogic = { steps };
    
    await pool.query(
      "UPDATE automation_flows SET execution_logic = $1, updated_at = NOW() WHERE id = $2",
      [JSON.stringify(finalLogic), flowId]
    );
    
    console.log(`Successfully rebuilt execution_logic for Douglas Bot with ${steps.length} nodes!`);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}
run();
