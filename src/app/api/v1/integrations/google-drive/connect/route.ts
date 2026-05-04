// src/app/api/v1/integrations/google-drive/connect/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getUserSession } from '@/app/actions';
import { googleDriveService } from '@/services/google-drive.service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const session = await getUserSession();
        if (!session?.user?.companyId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const personaId = searchParams.get('personaId') || '';

        // Encode state with company, user, and persona info
        const state = Buffer.from(JSON.stringify({
            companyId: session.user.companyId,
            userId: session.user.id,
            personaId,
        })).toString('base64');

        const authUrl = googleDriveService.getAuthUrl(state);

        return NextResponse.json({ url: authUrl });
    } catch (error) {
        console.error('[GoogleDrive Connect] Error:', error);
        return NextResponse.json({ error: 'Failed to generate auth URL' }, { status: 500 });
    }
}
