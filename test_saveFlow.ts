import { saveFlow } from "./src/lib/automations";

async function main() {
  const visualData = {
    nodes: [
      { id: "1", type: "trigger", position: { x: 0, y: 0 }, data: { triggerType: "message_received" } },
      { id: "2", type: "message", position: { x: 100, y: 100 }, data: { label: "msg" } }
    ],
    edges: [
      { id: "e1", source: "1", target: "2" }
    ]
  };

  const steps = [
    { type: "trigger", data: { triggerType: "message_received" } }
  ];

  try {
    const res = await saveFlow("new", "Teste Automacao", "7cb4773e-1fab-4699-b35d-c70d9f8d9149", visualData, steps);
    console.log("Result:", res);
  } catch (e) {
    console.error("Crash:", e);
  }
  process.exit(0);
}

main();
