// src/app/api/v1/media/refresh/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { getFileUrl, fileExists } from '@/lib/s3';
import { getCompanyIdFromSession } from '@/app/actions';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/media/refresh
 * 
 * Regenera uma URL de mídia que pode estar expirada.
 * Verifica se o arquivo existe no storage e retorna nova URL pública.
 * 
 * Body: { mediaUrl: string }
 * Response: { success: true, url: string } ou { success: false, error: string }
 */
export async function POST(request: NextRequest) {
    try {
        // Verificar autenticação
        const companyId = await getCompanyIdFromSession();
        if (!companyId) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { mediaUrl } = body;

        if (!mediaUrl || typeof mediaUrl !== 'string') {
            return NextResponse.json({
                success: false,
                error: 'mediaUrl is required'
            }, { status: 400 });
        }

        // Extrair s3Key da URL
        // Formatos possíveis:
        // - https://bucket.s3.region.amazonaws.com/tenants/companyId/media_recebida/xxx.jpg
        // - https://cdn.domain.com/tenants/companyId/media_recebida/xxx.jpg
        // - /api/storage/neon?key=tenants/companyId/...

        let s3Key: string | null = null;

        // Tentar extrair de URL S3/CloudFront
        const s3Match = mediaUrl.match(/(?:amazonaws\.com|cloudfront\.net)\/(.+)$/);
        if (s3Match && s3Match[1]) {
            s3Key = decodeURIComponent(s3Match[1]);
        }

        // Tentar extrair de URL Neon
        const neonMatch = mediaUrl.match(/[?&]key=([^&]+)/);
        if (neonMatch && neonMatch[1]) {
            s3Key = decodeURIComponent(neonMatch[1]);
        }

        // Tentar extrair de URLs com domínio customizado (CloudFront)
        if (!s3Key) {
            const pathMatch = mediaUrl.match(/https?:\/\/[^/]+\/(.+)$/);
            if (pathMatch && pathMatch[1] && pathMatch[1].startsWith('tenants/')) {
                s3Key = decodeURIComponent(pathMatch[1]);
            }
        }

        // Fallback: tentar extrair da última parte da URL
        if (!s3Key) {
            const urlParts = mediaUrl.split('/');
            const lastParts = urlParts.slice(-3).join('/'); // Pega os últimos 3 segmentos
            if (lastParts.includes('media_recebida')) {
                s3Key = `tenants/${companyId}/${lastParts}`;
            }
        }

        if (!s3Key) {
            console.warn(`[Media Refresh] Could not extract s3Key from URL: ${mediaUrl}`);
            return NextResponse.json({
                success: false,
                error: 'Could not parse media URL'
            }, { status: 400 });
        }

        // Verificar se a key pertence ao tenant correto (segurança)
        if (!s3Key.includes(companyId)) {
            console.warn(`[Media Refresh] Unauthorized access attempt. CompanyId: ${companyId}, Key: ${s3Key}`);
            return NextResponse.json({
                success: false,
                error: 'Unauthorized access to media'
            }, { status: 403 });
        }

        // Verificar se o arquivo existe
        const exists = await fileExists(companyId, s3Key);

        if (!exists) {
            console.log(`[Media Refresh] File not found in storage: ${s3Key}`);
            return NextResponse.json({
                success: false,
                error: 'Media file not found in storage'
            }, { status: 404 });
        }

        // Gerar nova URL pública
        const newUrl = getFileUrl(companyId, s3Key);

        console.log(`[Media Refresh] Successfully refreshed URL for key: ${s3Key}`);

        return NextResponse.json({
            success: true,
            url: newUrl,
            key: s3Key
        });

    } catch (error) {
        console.error('[Media Refresh] Error:', error);
        return NextResponse.json({
            success: false,
            error: (error as Error).message
        }, { status: 500 });
    }
}
