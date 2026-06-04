import { config } from "dotenv";

config({ path: ".env.local" });

async function testSend() {
  const instanceName = "26c20a74-01d0-44e8-b2c8-4af5f3146ca1";
  const apiUrl = process.env.EVOLUTION_API_URL || "https://evolution-api-production-a6f4.up.railway.app";
  const apiKey = process.env.EVOLUTION_API_KEY;
  
  let number = "5588920008007";
  
  const text = "Olá! Esta é uma mensagem de teste do sistema MasterIA para validar a conexão.";

  console.log(`Sending message via Evolution API...`);
  console.log(`Instance: ${instanceName}`);
  console.log(`To: ${number}`);
  console.log(`URL: ${apiUrl}/message/sendText/${instanceName}`);

  try {
    const res = await fetch(`${apiUrl}/message/sendText/${instanceName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": apiKey as string
      },
      body: JSON.stringify({
        number: number,
        text: text,
        delay: 1200
      })
    });

    if (!res.ok) {
      console.error("Evolution API error:", res.status, res.statusText);
      const errText = await res.text();
      console.error("Error body:", errText);
    } else {
      const data = await res.json();
      console.log("Success! Response from Evolution API:", JSON.stringify(data, null, 2));
    }
  } catch (e) {
    console.error("Fetch error:", e);
  }
}

testSend().catch(console.error).finally(() => process.exit(0));
