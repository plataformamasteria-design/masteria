import { callAI } from "../src/lib/ai-client";

async function main() {
  try {
    const res = await callAI({
      provider: "openai",
      systemPrompt: "Retorne um JSON com { \"diagnosis\": \"Tudo certo\" }",
      userContent: "Teste.",
      maxTokens: 100
    });
    console.log("SUCCESS:", res);
  } catch (err) {
    console.error("ERROR:", err);
  }
}

main();
