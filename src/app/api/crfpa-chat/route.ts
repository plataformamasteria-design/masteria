import { NextResponse } from 'next/server';
import { resolveAIKeys } from '@/lib/ai-keys-resolver';

export async function POST(req: Request) {
  try {
    const { messages, system } = await req.json();

    const keys = await resolveAIKeys(null);
    const apiKey = keys.openaiApiKey || process.env.OPENAI_API_KEY || "";
    
    if (!apiKey) {
      return NextResponse.json({ error: "OpenAI API Key not found" }, { status: 500 });
    }

    // Format messages for OpenAI (system prompt goes first)
    const formattedMessages = [
      { role: "system", content: system },
      ...messages
    ];

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: formattedMessages,
        max_tokens: 600,
        temperature: 0.3
      }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error("[CRF-PA Chat] OpenAI Error:", errorText);
        return NextResponse.json({ error: "Failed to communicate with OpenAI" }, { status: response.status });
    }

    const data = await response.json();
    const assistantText = data.choices[0]?.message?.content || "";
    
    return NextResponse.json({
        text: assistantText
    });
    
  } catch (error: any) {
    console.error("[CRF-PA Chat] Internal Server Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
