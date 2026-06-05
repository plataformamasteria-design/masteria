import { NextRequest, NextResponse } from 'next/server';
import { getCompanyIdFromSession } from '@/app/actions';

// external-api: untyped — fal.ai FLUX Kontext Multi
// Direct pipeline: lead photo + product photo → fal.ai → combined image
// NO transcription, NO GPT intermediaries

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// ── Fetch image URL or base64 data URL → Buffer ───────────────────────────────

async function fetchToBuffer(url: string): Promise<{ buffer: Buffer; mime: string }> {
    if (url.startsWith('data:')) {
        const commaIdx = url.indexOf(',');
        const mime = url.slice(0, commaIdx).replace('data:', '').replace(';base64', '');
        return { buffer: Buffer.from(url.slice(commaIdx + 1), 'base64'), mime };
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Falha ao baixar imagem (${res.status}): ${url.slice(0, 100)}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    const mime = res.headers.get('content-type') || 'image/jpeg';
    return { buffer, mime };
}

// ── Resize image to JPEG ≤ 1920px using sharp ─────────────────────────────────

async function toJpeg(buffer: Buffer, maxSize = 1920): Promise<Buffer> {
    try {
        const sharp = (await import('sharp')).default;
        return await sharp(buffer)
            .resize(maxSize, maxSize, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 92 })
            .toBuffer();
    } catch {
        return buffer;
    }
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
    try {
        const companyId = await getCompanyIdFromSession();
        const body = await req.json();
        const {
            libraryImageUrl,
            libraryImageName,
            libraryImageDescription,
            leadImageUrl,
            promptOverride,
            strengthOverride,
            modelOverride,
            simulateTarget,
        } = body as {
            libraryImageUrl: string;
            libraryImageName?: string;
            libraryImageDescription?: string;
            leadImageUrl: string;
            promptOverride?: string;
            strengthOverride?: number;
            modelOverride?: string;
            simulateTarget?: string;
        };

        if (!libraryImageUrl || !leadImageUrl) {
            return NextResponse.json(
                { error: 'libraryImageUrl e leadImageUrl são obrigatórios' },
                { status: 400 }
            );
        }

        const falKey = process.env.FAL_KEY || process.env.FAL_API_KEY;
        if (!falKey) {
            return NextResponse.json(
                { error: 'FAL_KEY não configurada. Adicione sua chave do fal.ai no .env.local' },
                { status: 500 }
            );
        }

        const { fal } = await import('@fal-ai/client');
        fal.config({ credentials: falKey });

        // ── Extract visual material description from filename + description ────────
        // Goal: turn "Pia-de-Granito-Azul-2.jpg" + desc:"granito" into
        //        "granito azul (blue granite) — deep blue with silver-white veining, polished surface"
        // This gives FLUX Kontext enough visual context to apply the correct texture.
        const fileName = libraryImageName || libraryImageUrl.split('/').pop()?.split('?')[0] || '';
        const cleanProductName = fileName
            .replace(/_/g, ' ')
            .replace(/\.[a-z]{2,4}$/i, '')
            .replace(/\s+/g, ' ')
            .trim();

        const nameLower = cleanProductName.toLowerCase().replace(/[_\-]/g, ' ');
        const descLower = (libraryImageDescription || '').toLowerCase();
        const combined = `${nameLower} ${descLower}`;

        // Color mapping PT→EN with visual hints
        const colorMap: Record<string, { en: string; hint: string }> = {
            'azul':     { en: 'blue',   hint: 'deep blue tones with white veining' },
            'preto':    { en: 'black',  hint: 'jet black with subtle gray veining' },
            'branco':   { en: 'white',  hint: 'pure white with fine gray veining' },
            'cinza':    { en: 'gray',   hint: 'medium gray with darker veining' },
            'bege':     { en: 'beige',  hint: 'warm beige with cream tones' },
            'verde':    { en: 'green',  hint: 'deep green with crystalline texture' },
            'vermelho': { en: 'red',    hint: 'rich red with dark veining' },
            'amarelo':  { en: 'yellow', hint: 'warm yellow-golden tones' },
            'rosa':     { en: 'pink',   hint: 'soft pink with white veining' },
            'marrom':   { en: 'brown',  hint: 'warm brown with cream highlights' },
            'dourado':  { en: 'golden', hint: 'golden tones with bronze veining' },
        };
        // Material mapping PT→EN with visual finish hints
        const materialMap: Record<string, { en: string; finish: string }> = {
            'granito':      { en: 'granite',       finish: 'crystalline, polished surface with visible mineral grains' },
            'marmore':      { en: 'marble',        finish: 'smooth polished surface with elegant veining patterns' },
            'porcelanato':  { en: 'porcelain tile', finish: 'uniform matte or glossy finish, geometric texture' },
            'ceramica':     { en: 'ceramic tile',   finish: 'smooth glazed surface' },
            'madeira':      { en: 'wood',           finish: 'natural wood grain texture' },
            'concreto':     { en: 'concrete',       finish: 'rough matte surface with subtle texture' },
            'quartzito':    { en: 'quartzite',      finish: 'natural stone with fine crystalline texture' },
        };

        let colorPt = '', colorHint = '', colorEn = '';
        let materialPt = '', materialFinish = '', materialEn = '';

        for (const [pt, { en, hint }] of Object.entries(colorMap)) {
            if (combined.includes(pt)) { colorPt = pt; colorEn = en; colorHint = hint; break; }
        }
        for (const [pt, { en, finish }] of Object.entries(materialMap)) {
            if (combined.includes(pt)) { materialPt = pt; materialEn = en; materialFinish = finish; break; }
        }

        // Build the visual material description for the prompt
        // e.g. "granito azul (blue granite) — deep blue tones with white veining, crystalline polished surface"
        const materialDescPt = [materialPt, colorPt].filter(Boolean).join(' ') || cleanProductName;
        const materialDescEn = [colorEn, materialEn].filter(Boolean).join(' ');
        const visualHints = [colorHint, materialFinish].filter(Boolean).join(', ');

        const materialLabel = materialDescPt
            + (materialDescEn ? ` (${materialDescEn})` : '')
            + (visualHints ? ` — ${visualHints}` : '');

        console.log(`[transform-image] Material resolved: "${materialLabel}" from file "${fileName}", desc "${libraryImageDescription}"`);

        // Step 1: Download only the lead image (base structure)
        console.log('[transform-image] Downloading lead image...');
        const rawLead = await fetchToBuffer(leadImageUrl);

        let targetModel = 'fal-ai/flux/dev/image-to-image';
        let targetResolution = 1920;
        let targetSteps = 30;

        if (modelOverride) {
            const parts = modelOverride.split('|');
            targetModel = parts[0];
            if (parts.length > 1) targetResolution = parseInt(parts[1], 10) || 1920;
            if (parts.length > 2) targetSteps = parseInt(parts[2], 10) || 30;
        }

        // Detect if we are calling a FLUX Kontext model (different API schema)
        const isKontextModel = targetModel.includes('kontext');

        // Step 2: Convert to JPEG and resize
        const leadJpeg = await toJpeg(rawLead.buffer, targetResolution);

        // Step 3: Prepare Base64 Data URL
        console.log('[transform-image] Converting to base64 data URLs...');
        const leadUrl = `data:image/jpeg;base64,${leadJpeg.toString('base64')}`;
        console.log('[transform-image] Lead URL length:', leadUrl.length);

        // Step 4: Build prompt
        // For Kontext: use rich visual material description (no reference image available)
        // For FLUX Dev: simpler prompt is OK because reference image is passed via image_prompts
        const target = simulateTarget || 'countertop surface';

        let prompt = isKontextModel
            ? [
                `Replace the ENTIRE ${target} from edge to edge with ${materialLabel}.`,
                `This includes ALL areas of the ${target}: flat surfaces, drain boards, ribbed sections, grids, textured zones — replace it all with a uniform stone slab.`,
                `The new surface must be completely smooth and free of any existing patterns, grids, or ribs.`,
                `Material: ${materialDescEn || materialDescPt}. Appearance: ${visualHints || 'realistic texture, polished finish'}.`,
                'Photorealistic result, 8k quality.',
                'KEEP UNCHANGED: stainless steel sink bowl/basin, faucet, tap, walls, tiles, cabinets, furniture, handles, plants, lighting. Only the flat stone surface changes.',
            ].join(' ')
            : [
                `Replace the ENTIRE ${target} from edge to edge with this material: ${materialLabel}.`,
                `Cover ALL surface areas completely — including drain boards, ribs, or textured areas.`,
                'Photorealistic, 8k quality.',
                'Keep ONLY these unchanged: stainless steel sink bowl, faucet, walls, cabinets, layout, lighting.',
            ].join(' ');

        if (promptOverride && promptOverride.trim().length > 0) {
            prompt = promptOverride
                .replace(/\{\{produto\}\}/g, materialLabel)
                .replace(/\{\{alvo\}\}/g, target);
        }


        // Determine strength. Convert 1-100 scale to 0.0-1.0 scale if provided.
        const strength = strengthOverride !== undefined ? (strengthOverride / 100) : 0.80;

        let lastError: Error | null = null;

        try {
            console.log(`[transform-image] Trying model: ${targetModel} | Kontext: ${isKontextModel} | product: ${cleanProductName}`);

            // ── Build model-specific input payload ────────────────────────────────────
            // FLUX Kontext (kontext/max, kontext) → uses image_url for the scene photo.
            // The product reference image is embedded in the prompt as a reference instruction.
            // FLUX Dev image-to-image → uses image_url for scene + image_prompts for style reference.
            let falInput: Record<string, unknown>;

            if (isKontextModel) {
                // ── Step 1: GPT-4o Vision — analyze product image for detailed material description ──
                // GPT-4o Vision sees the actual product photo and generates a precise visual spec
                // that FLUX Kontext can use to apply the exact material, color, and texture.
                const openaiKey = process.env.OPENAI_API_KEY_AGENTS1 || process.env.OPENAI_API_KEY;

                let gptMaterialDescription = '';

                if (openaiKey) {
                    try {
                        console.log('[transform-image] Calling GPT-4o Vision to analyze product image...');
                        const OpenAI = (await import('openai')).default;
                        const openai = new OpenAI({ apiKey: openaiKey });

                        // Download product image and convert to base64 for GPT-4 Vision
                        const rawProduct = await fetchToBuffer(libraryImageUrl);
                        const productJpeg = await toJpeg(rawProduct.buffer, 1024);
                        const productBase64 = `data:image/jpeg;base64,${productJpeg.toString('base64')}`;

                        const visionResponse = await openai.chat.completions.create({
                            model: 'gpt-4o',
                            max_tokens: 600,
                            messages: [{
                                role: 'user',
                                content: [
                                    {
                                        type: 'image_url',
                                        image_url: { url: productBase64, detail: 'high' }
                                    },
                                    {
                                        type: 'text',
                                        text: [
                                            `You are a precision material descriptor for photorealistic image generation using AI diffusion models.`,
                                            `Analyze this product image and write an extremely detailed visual specification.`,
                                            `Product name: "${cleanProductName}".`,
                                            `User description: "${libraryImageDescription || 'not provided'}".`,
                                            ``,
                                            `Your description MUST include:`,
                                            `1. Exact material type (e.g., granite, marble, quartzite, porcelain)`,
                                            `2. Precise color tones (e.g., "deep midnight blue with silver-white branching veins", NOT just "blue")`,
                                            `3. Surface finish (polished/matte/honed/brushed)`,
                                            `4. Veining or grain patterns (direction, thickness, color of veins)`,
                                            `5. Texture and reflectivity (glossy, crystalline, rough)`,
                                            `6. Any distinctive markings, spots, or special visual features`,
                                            ``,
                                            `Format: Write 3-4 sentences as a dense material specification. Be extremely precise — this text will be used to instruct an AI to replicate this exact material in a photorealistic simulation.`,
                                            `Do NOT describe the shape, size, or context of what the material is applied to. Only describe the material itself.`,
                                        ].join('\n')
                                    }
                                ]
                            }]
                        });

                        gptMaterialDescription = visionResponse.choices[0]?.message?.content?.trim() || '';
                        console.log(`[transform-image] GPT-4o Vision description: "${gptMaterialDescription.slice(0, 150)}..."`);

                    } catch (gptErr: any) {
                        console.warn('[transform-image] GPT-4o Vision failed, falling back to filename-based description:', gptErr.message);
                    }
                } else {
                    console.warn('[transform-image] No OpenAI key found — using filename-based material description as fallback.');
                }

                // Use GPT description if available, otherwise fall back to filename-based extraction
                const finalMaterialDescription = gptMaterialDescription || materialLabel;

                // ── Step 2: Build FLUX Kontext prompt with GPT material specification ──
                // CRITICAL: prompt must be explicit that the ENTIRE countertop (including drain boards,
                // ribbed areas, grids and textured surfaces) is replaced — not just the flat top.
                // "Keep everything identical" without this causes the model to preserve drain grids.
                const kontextPrompt = promptOverride?.trim()
                    ? promptOverride
                        .replace(/\{\{produto\}\}/g, finalMaterialDescription)
                        .replace(/\{\{alvo\}\}/g, target)
                    : [
                        `Replace the ENTIRE ${target} in this image with a continuous slab of ${cleanProductName}.`,
                        `The ${target} replacement must cover the COMPLETE surface from edge to edge,`,
                        `including any drain boards, ribbed sections, grid areas, or textured zones that exist on the original surface.`,
                        `The result should be a flat, uniform stone slab — completely removing any existing surface patterns, grids, ribs, or textures.`,
                        `Exact material specification for the new surface: ${finalMaterialDescription}`,
                        `Photorealistic result, 8k quality.`,
                        `KEEP UNCHANGED (do not touch): the stainless steel sink bowl/basin, faucet, tap, walls, tiles, cabinets, furniture, plants, handles, lighting, shadows.`,
                        `The sink bowl and faucet must remain exactly as they are — only the flat stone surface around them changes.`,
                    ].join(' ');

                falInput = {
                    prompt: kontextPrompt,
                    image_url: leadUrl,
                    num_inference_steps: targetSteps,
                    guidance_scale: 5.0,   // Raised from 3.5 — stronger prompt adherence for full surface replacement
                    output_format: 'jpeg',
                };

                console.log(`[transform-image] Kontext prompt built. GPT vision: ${gptMaterialDescription ? '✅' : '❌ fallback'}`);

            } else {
                // FLUX Dev Image-to-Image: supports reference images via image_prompts.
                // The product photo is passed directly as a visual style reference.
                // This IS the native reference-image approach — the model sees the actual product texture.

                // - strength: how much to deviate from original (0-1)
                falInput = {
                    prompt,
                    image_url: leadUrl,
                    strength,
                    num_inference_steps: targetSteps,
                    guidance_scale: 3.5,
                    output_format: 'jpeg',
                    image_prompts: [
                        { image_url: libraryImageUrl }
                    ],
                };
                console.log('[transform-image] Using FLUX Dev image-to-image schema (with image_prompts).');
            }

            const result = await (fal as any).subscribe(targetModel, {
                    input: falInput,
                    logs: true,
                    onQueueUpdate: (update: any) => {
                        if (update.status === 'IN_PROGRESS') {
                            update.logs?.slice(-3).forEach((log: any) =>
                                console.log(`[fal.ai/${targetModel}]`, log.message)
                            );
                        }
                    },
                }) as any;

                const resultUrl =
                    result?.data?.images?.[0]?.url ||
                    result?.images?.[0]?.url ||
                    result?.data?.image?.url;

                if (!resultUrl) throw new Error('Resposta sem imagem');

                console.log(`[transform-image] ✅ Success with ${targetModel}`);
                return NextResponse.json({ resultUrl, model: targetModel });

        } catch (err: any) {
                const errorDetail = err.body?.detail || err.message || '';
                console.warn(`[transform-image] ${targetModel} failed:`, errorDetail);
                lastError = err;

                if (errorDetail.toLowerCase().includes('exhausted') || errorDetail.toLowerCase().includes('balance')) {
                    throw new Error('Saldo insuficiente na conta Fal.ai. Por favor, recarregue os créditos.');
                }
                if (err.status === 403 || err.status === 401) {
                    throw new Error(`Erro de Autenticação (403): Chave de API inválida ou não reconhecida. (Se você trocou a chave no .env, REINICIE o terminal rodando npm run dev).`);
                }

                throw lastError || new Error('Falha ao chamar modelo fal.ai');
        }

    } catch (err: any) {
        console.error('[transform-image] Fatal error:', err?.message || err);
        return NextResponse.json(
            { error: err.message || 'Erro ao gerar simulação com fal.ai' },
            { status: 500 }
        );
    }
}
