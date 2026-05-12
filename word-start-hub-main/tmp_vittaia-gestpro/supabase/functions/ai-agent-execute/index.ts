import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Tool {
  name: string;
  description: string;
  parameters: Record<string, any>;
}

interface AgentRequest {
  prompt: string;
  system_message: string;
  model: string;
  provider: string;
  credential_id: string;
  organization_id: string;
  memory_key: string;
  context_window_length: number;
  temperature: number;
  max_iterations: number;
  tools: Tool[];
  input_data: Record<string, any>;
  enforce_vitta_token_usage?: boolean;
}

async function callOpenAI(apiKey: string, model: string, messages: any[], tools: any[], temperature: number) {
  const body: any = {
    model,
    messages,
    temperature,
  };

  if (tools.length > 0) {
    body.tools = tools.map((t) => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters || { type: "object", properties: {} },
      },
    }));
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${text}`);
  }

  const data = await response.json();
  // Normalize usage
  if (data.usage) {
    data._usage = {
      prompt_tokens: data.usage.prompt_tokens || 0,
      completion_tokens: data.usage.completion_tokens || 0,
      total_tokens: data.usage.total_tokens || 0,
    };
  }
  return data;
}

async function callGemini(apiKey: string, model: string, messages: any[], tools: any[], temperature: number) {
  // Convert OpenAI-style messages to Gemini format
  const systemInstruction = messages.find((m: any) => m.role === "system");
  const contents = messages
    .filter((m: any) => m.role !== "system")
    .map((m: any) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  const geminiModel = model.startsWith("gemini-") ? model : "gemini-2.5-flash";

  const body: any = {
    contents,
    generationConfig: { temperature },
  };

  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction.content }] };
  }

  if (tools.length > 0) {
    body.tools = [
      {
        functionDeclarations: tools.map((t: any) => ({
          name: t.name,
          description: t.description,
          parameters: t.parameters || { type: "object", properties: {} },
        })),
      },
    ];
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${text}`);
  }

  const data = await response.json();

  // Convert Gemini response to OpenAI-compatible format
  const candidate = data.candidates?.[0];
  const parts = candidate?.content?.parts || [];

  const textParts = parts.filter((p: any) => p.text).map((p: any) => p.text).join("");
  const functionCalls = parts.filter((p: any) => p.functionCall);

  // Extract Gemini usage metadata
  const usageMetadata = data.usageMetadata || {};

  const result: any = {
    choices: [
      {
        message: {
          role: "assistant",
          content: textParts || null,
        },
        finish_reason: functionCalls.length > 0 ? "tool_calls" : "stop",
      },
    ],
    _usage: {
      prompt_tokens: usageMetadata.promptTokenCount || 0,
      completion_tokens: usageMetadata.candidatesTokenCount || 0,
      total_tokens: usageMetadata.totalTokenCount || 0,
    },
  };

  if (functionCalls.length > 0) {
    result.choices[0].message.tool_calls = functionCalls.map((fc: any, i: number) => ({
      id: `call_${i}`,
      type: "function",
      function: {
        name: fc.functionCall.name,
        arguments: JSON.stringify(fc.functionCall.args || {}),
      },
    }));
  }

  return result;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: AgentRequest = await req.json();
    const {
      prompt,
      system_message,
      model,
      provider,
      credential_id,
      organization_id,
      memory_key,
      context_window_length = 5,
      temperature = 0.7,
      max_iterations = 5,
      tools = [],
      input_data = {},
      enforce_vitta_token_usage = false,
    } = body;

    // 1. Get API key from credentials (support Vitta I.A global keys)
    let apiKey: string;
    let resolvedProvider = provider;

    if (credential_id === "vitta-openai" || credential_id === "vitta-gemini") {
      const configKey = credential_id === "vitta-openai" ? "openai_api_key" : "gemini_api_key";
      const { data: globalCfg, error: cfgError } = await supabase
        .from("global_config")
        .select("value")
        .eq("key", configKey)
        .single();
      if (cfgError || !globalCfg?.value) {
        throw new Error(`Credencial Vitta I.A (${configKey}) não configurada na plataforma`);
      }
      apiKey = globalCfg.value;
      resolvedProvider = credential_id === "vitta-openai" ? "openai" : "gemini";
    } else {
      const { data: cred, error: credError } = await supabase
        .from("ai_agent_credentials")
        .select("api_key, provider")
        .eq("id", credential_id)
        .eq("organization_id", organization_id)
        .single();
      if (credError || !cred) {
        throw new Error("Credencial não encontrada ou sem permissão");
      }
      apiKey = cred.api_key;
      resolvedProvider = cred.provider;
    }

    // apiKey and resolvedProvider already set above

    // 2. Load memory (last N messages)
    let memoryMessages: any[] = [];
    if (memory_key) {
      const { data: memData } = await supabase
        .from("ai_agent_memory")
        .select("messages")
        .eq("organization_id", organization_id)
        .eq("memory_key", memory_key)
        .single();

      if (memData?.messages) {
        const allMsgs = memData.messages as any[];
        memoryMessages = allMsgs.slice(-context_window_length * 2);
      }
    }

    // 3. Build messages
    const messages: any[] = [];
    if (system_message) {
      messages.push({ role: "system", content: system_message });
    }

    // Add memory context
    messages.push(...memoryMessages);

    // Build user prompt with input data
    let userPrompt = prompt || "";
    if (Object.keys(input_data).length > 0) {
      userPrompt += "\n\nDados de entrada:\n" + JSON.stringify(input_data, null, 2);
    }
    messages.push({ role: "user", content: userPrompt });

    // 4. Agent loop (tool calling)
    const callFn = resolvedProvider === "gemini" ? callGemini : callOpenAI;
    let response: any;
    let iterations = 0;
    const toolResults: any[] = [];
    let totalUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

    while (iterations < max_iterations) {
      iterations++;
      response = await callFn(apiKey, model, messages, tools, temperature);

      // Accumulate token usage from each iteration
      if (response._usage) {
        totalUsage.prompt_tokens += response._usage.prompt_tokens;
        totalUsage.completion_tokens += response._usage.completion_tokens;
        totalUsage.total_tokens += response._usage.total_tokens;
      }

      const choice = response.choices?.[0];
      if (!choice) break;

      const msg = choice.message;

      // If no tool calls, we're done
      if (!msg.tool_calls || msg.tool_calls.length === 0) {
        break;
      }

      // Process tool calls
      messages.push(msg);

      for (const toolCall of msg.tool_calls) {
        const fnName = toolCall.function.name;
        let fnArgs: any = {};
        try {
          fnArgs = JSON.parse(toolCall.function.arguments || "{}");
        } catch { }

        // We return tool call info so the automation executor can handle them
        toolResults.push({
          tool_call_id: toolCall.id,
          name: fnName,
          arguments: fnArgs,
        });

        // Add a placeholder response so the model can continue
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify({ status: "executed", result: fnArgs }),
        });
      }
    }

    // 5. Extract final response
    const finalMessage = response?.choices?.[0]?.message?.content || "";

    // 6. Save to memory
    if (memory_key) {
      const newMessages = [
        ...memoryMessages,
        { role: "user", content: userPrompt },
        { role: "assistant", content: finalMessage },
      ];

      // Keep only last N*2 messages
      const trimmed = newMessages.slice(-(context_window_length * 2));

      await supabase
        .from("ai_agent_memory")
        .upsert(
          {
            organization_id,
            memory_key,
            messages: trimmed,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "organization_id,memory_key" }
        );
    }

    // Optional direct token accounting for editor/manual test execution (Vitta I.A only)
    if (enforce_vitta_token_usage && (credential_id === "vitta-openai" || credential_id === "vitta-gemini") && totalUsage.total_tokens > 0) {
      // Atomic increment via RPC
      await supabase.rpc("increment_token_usage", {
        p_organization_id: organization_id,
        p_provider: resolvedProvider,
        p_amount: totalUsage.total_tokens
      });

      await supabase.from("token_transactions").insert({
        organization_id,
        provider: resolvedProvider,
        transaction_type: "consumption",
        amount: totalUsage.total_tokens,
        description: `Teste manual AI Agent | Tokens: ${totalUsage.total_tokens} (prompt: ${totalUsage.prompt_tokens}, completion: ${totalUsage.completion_tokens})`,
      });
    }

    return new Response(
      JSON.stringify({
        output: finalMessage,
        tool_calls: toolResults,
        iterations,
        model,
        provider: resolvedProvider,
        usage: totalUsage,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("AI Agent error:", error);
    const errorMessage = error.message || "Erro desconhecido na execução da I.A";
    return new Response(
      JSON.stringify({
        error: true,
        message: errorMessage,
        details: error.toString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
