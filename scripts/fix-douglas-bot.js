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
    
    const triggerNode = {
      "id": "1",
      "type": "trigger",
      "position": { "x": 100, "y": 100 },
      "data": {
        "triggerType": "message_received",
        "trigger_type": "message_received",
        "message_category": "general",
        "label": "Qualquer Mensagem Recebida"
      }
    };
    
    // 1. Fix visual_data
    if (!visual.nodes.find(n => n.id === '1')) {
      visual.nodes.unshift(triggerNode);
    } else {
      // If it exists but is corrupted, overwrite it
      const idx = visual.nodes.findIndex(n => n.id === '1');
      visual.nodes[idx] = triggerNode;
    }
    
    // 2. Fix execution_logic
    const triggerLogic = {
      "id": "1",
      "type": "trigger",
      "data": triggerNode.data,
      "nextSteps": []
    };
    
    // Find what it connects to
    const targetEdges = visual.edges.filter(e => e.source === '1');
    if (targetEdges.length > 0) {
      triggerLogic.nextSteps = targetEdges.map(e => e.target);
    }
    
    const steps = Array.isArray(logic) ? logic : (logic.steps || []);
    if (!steps.find(s => s.id === '1')) {
      steps.unshift(triggerLogic);
    } else {
      const idx = steps.findIndex(s => s.id === '1');
      steps[idx] = triggerLogic;
    }
    
    const finalLogic = Array.isArray(logic) ? steps : { ...logic, steps };
    
    // 3. UPDATE database
    await pool.query(
      "UPDATE automation_flows SET trigger_type = 'message_received', visual_data = $1, execution_logic = $2, updated_at = NOW() WHERE id = $3",
      [JSON.stringify(visual), JSON.stringify(finalLogic), flowId]
    );
    
    console.log('Successfully fixed trigger node for Douglas Bot!');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}
run();
