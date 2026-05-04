// src/app/api/v1/media/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { mediaAssets } from '@/lib/db/schema';
import { eq, desc, and, SQL } from 'drizzle-orm';
import { getCompanyIdFromSession } from '@/app/actions';

export const dynamic = 'force-dynamic';

// GET /api/v1/media - List all media assets for the company
export async function GET(request: NextRequest) {
    try {
        const companyId = await getCompanyIdFromSession();
        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type');

        const whereClauses: (SQL | undefined)[] = [
            eq(mediaAssets.companyId, companyId)
        ];

        if (type) {
            whereClauses.push(eq(mediaAssets.type, type));
        }

        const assets = await db.select({
            id: mediaAssets.id,
            name: mediaAssets.name,
            type: mediaAssets.type,
            fileSize: mediaAssets.fileSize,
            s3Url: mediaAssets.s3Url,
            s3Key: mediaAssets.s3Key,
            metaHandles: mediaAssets.metaHandles,
            createdAt: mediaAssets.createdAt,
        })
            .from(mediaAssets)
            .where(and(...whereClauses.filter((c): c is SQL => !!c)))
            .orderBy(desc(mediaAssets.createdAt));
        
        return NextResponse.json(assets);

    } catch(error) {
        console.error('Erro ao listar mídias:', error);
        return NextResponse.json({ error: (error as Error).message, details: (error as Error).stack }, { status: 500 });
    }
}
