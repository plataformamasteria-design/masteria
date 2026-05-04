// src/app/api/v1/conversations/[conversationId]/media/route.ts
import { NextResponse, type NextRequest } from 'next/server';

/**
 * @deprecated This endpoint is disabled for the MVP.
 * The ability to send media files through the chat will be re-introduced in a future version.
 */

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function POST(_request: NextRequest, _params: { params: { conversationId: string } }) {
    return NextResponse.json(
        { 
            error: 'Funcionalidade Indisponível',
            message: 'O envio de arquivos de mídia pelo chat está temporariamente desativado.'
        }, 
        { status: 501 } // 501 Not Implemented
    );
}
