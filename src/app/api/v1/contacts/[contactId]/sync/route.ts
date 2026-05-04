// src/app/api/v1/contacts/[contactId]/sync/route.ts

import { NextResponse, type NextRequest } from 'next/server';

/**
 * @deprecated Esta funcionalidade não é suportada pela API da Meta da forma que foi implementada.
 * A busca de perfis de contato sob demanda não é permitida. Os dados de perfil (nome, foto)
 * são capturados apenas no momento da primeira mensagem recebida via webhook.
 */
async function _getProfileFromMeta(_waId: string, _accessToken: string) {
    // A API da Meta espera o número sem o '+'.
    // const phoneWithoutPlus = waId.startsWith('+') ? waId.substring(1) : waId;
    // // Esta chamada de API está incorreta e é a fonte do erro.
    // // A API não permite buscar um perfil de utilizador final desta forma.
    // const url = `https://graph.facebook.com/v20.0/${phoneWithoutPlus}?fields=profile_picture_url,name`;
    // const response = await fetch(url, {
    //     headers: {
    //         'Authorization': `Bearer ${accessToken}`
    //     }
    // });

    // if (!response.ok) {
    //     const errorData = await response.json();
    //     if (process.env.NODE_ENV !== 'production') console.debug("Meta Profile Fetch Error:", errorData);
    //     throw new Error(errorData.error?.message || "Não foi possível buscar os dados do perfil na Meta.");
    // }
    // return response.json();
}



// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function POST(_request: NextRequest, _params: { params: { contactId: string } }) {
    // Retornando um erro claro indicando que a funcionalidade foi descontinuada.
     return NextResponse.json({ 
        error: 'Funcionalidade descontinuada.',
        message: 'A sincronização manual de perfis não é suportada pela API da Meta. Os dados do perfil são capturados automaticamente na primeira mensagem recebida do contato.'
    }, { status: 400 });
}
