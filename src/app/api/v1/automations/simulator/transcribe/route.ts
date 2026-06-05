import { NextRequest, NextResponse } from "next/server";
import { OpenAI } from "openai";
import { resolveAIKeys } from '@/lib/ai-keys-resolver';
import { getCompanyIdFromSession } from '@/app/actions';

export const maxDuration = 60; // 60 seconds timeout

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
        }

        const mimeType = file.type;
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const companyId = await getCompanyIdFromSession();
        const resolvedKeys = await resolveAIKeys(companyId);
        const resolvedOpenAIApiKey = resolvedKeys.openaiApiKey || process.env.OPENAI_API_KEY_AGENTS1 || process.env.OPENAI_API_KEY;

        let transcription = "";

        // 1. PDF - Parse natively to save tokens
        if (mimeType === "application/pdf") {
            const pdfParse = (await import("pdf-parse")).default;
            const data = await pdfParse(buffer);
            transcription = data.text;
        } 
        // 2. Audio - Use Whisper
        else if (mimeType.startsWith("audio/") || mimeType.startsWith("video/")) {
            const apiKey = resolvedOpenAIApiKey;
            if (!apiKey) throw new Error("OpenAI API Key não configurada");
            const openai = new OpenAI({ apiKey });

            // Ensure valid audio format for whisper (whisper accepts mp3, mp4, mpeg, mpga, m4a, wav, webm)
            const fileForm = new File([buffer], file.name, { type: mimeType });
            const response = await openai.audio.transcriptions.create({
                file: fileForm,
                model: "whisper-1",
            });
            transcription = response.text;
        } 
        // 3. Image - Use Vision (Switched back to OpenAI GPT-4o)
        else if (mimeType.startsWith("image/")) {
            const apiKey = resolvedOpenAIApiKey;
            if (!apiKey) throw new Error("OpenAI API Key não configurada");
            const openai = new OpenAI({ apiKey });

            const base64Image = buffer.toString("base64");
            const dataUrl = `data:${mimeType};base64,${base64Image}`;

            const response = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [
                    {
                        role: "user",
                        content: [
                            { type: "text", text: "Você é um assistente de extração de dados. Descreva detalhadamente esta imagem e transcreva TODO E QUALQUER texto legível nela. Caso seja uma oferta ou catálogo, liste os produtos e valores exatos." },
                            { type: "image_url", image_url: { url: dataUrl } }
                        ]
                    }
                ],
                max_tokens: 300,
            });

            transcription = response.choices[0]?.message?.content || "";
        } 
        // 4. TXT / CSV / etc
        else if (mimeType.startsWith("text/")) {
            transcription = buffer.toString("utf-8");
        } 
        else {
            return NextResponse.json({ error: "Formato de arquivo não suportado para transcrição simulada." }, { status: 400 });
        }

        return NextResponse.json({ 
            success: true, 
            transcription: transcription.trim() || "[Nenhum texto detectado]"
        });

    } catch (error: any) {
        console.error("[Transcribe API] Error:", error);
        return NextResponse.json({ error: error.message || "Erro interno na transcrição" }, { status: 500 });
    }
}
// Cache bust to force Next.js Turbopack recompile
