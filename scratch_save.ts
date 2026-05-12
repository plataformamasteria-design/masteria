import { saveFlow } from './src/lib/automations';

async function run() {
    const flowId = '1b8eb309-8d76-4d27-817c-0e78c85ad055'; // Douglas Bot
    const companyId = 'fae62e92-d9f7-4148-9366-da229cdab872'; // Douglas Resende
    const name = 'Douglas Bot';
    
    const visualData = {
        nodes: [
            { id: "1", type: "trigger", position: { x: 0, y: 0 }, data: { triggerType: "message_received" } }
        ],
        edges: []
    };
    const steps = [
        { id: "1", type: "trigger", data: { triggerType: "message_received" }, nextSteps: [], connections: [] }
    ];

    try {
        const result = await saveFlow(flowId, name, companyId, visualData, steps);
        console.log("SaveFlow Result:", result);
    } catch (e) {
        console.error("Caught error:", e);
    }
    process.exit(0);
}
run();
