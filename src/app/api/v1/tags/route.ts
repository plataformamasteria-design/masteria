

import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { tags } from '@/lib/db/schema';
import { eq, desc, and, ilike, count, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import { getCompanyIdFromSession } from '@/app/actions';


const tagSchema = z.object({
    name: z.string().min(1, 'Nome da tag é obrigatório'),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Cor inválida. Use o formato hexadecimal (ex: #RRGGBB).'),
});

// GET /api/v1/tags - List tags

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const companyId = await getCompanyIdFromSession();
        const { searchParams } = new URL(request.url);

        const page = parseInt(searchParams.get('page') || '1', 10);
        const limit = parseInt(searchParams.get('limit') || '10', 10);
        const search = searchParams.get('search');
        const offset = (page - 1) * limit;

        const whereClauses: (SQL | undefined)[] = [eq(tags.companyId, companyId)];
        if (search) {
            whereClauses.push(ilike(tags.name, `%${search}%`));
        }

        const finalWhereClauses = and(...whereClauses.filter((c): c is SQL => !!c));

        const companyTagsQuery = db
            .select()
            .from(tags)
            .where(finalWhereClauses)
            .orderBy(desc(tags.createdAt))
            .limit(limit)
            .offset(offset);

        const totalResult = await db.select({ count: count() }).from(tags).where(finalWhereClauses);
        
        const companyTags = await companyTagsQuery;
        const totalCount = totalResult[0]?.count ?? 0;

        return NextResponse.json({
            data: companyTags,
            totalPages: Math.ceil(totalCount / limit)
        });
    } catch (error) {
        console.error('Erro ao buscar tags:', error);
        const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor.';
        return NextResponse.json({ error: errorMessage, details: (error as Error).stack }, { status: 500 });
    }
}

// POST /api/v1/tags - Create a new tag
export async function POST(request: NextRequest) {
    try {
        const companyId = await getCompanyIdFromSession();
        const body = await request.json();
        const parsedData = tagSchema.safeParse(body);

        if (!parsedData.success) {
            return NextResponse.json({ error: 'Dados inválidos.', details: parsedData.error.flatten() }, { status: 400 });
        }
        const { name, color } = parsedData.data;

        // VERIFICAÇÃO DE DUPLICATAS
        const [existing] = await db.select().from(tags).where(and(eq(tags.companyId, companyId), eq(tags.name, name)));
        if (existing) {
            return NextResponse.json({ error: 'Já existe uma tag com este nome.' }, { status: 409 });
        }

        const [newTag] = await db.insert(tags).values({
            companyId,
            name,
            color,
        }).returning();

        return NextResponse.json(newTag, { status: 201 });

    } catch (error) {
        console.error('Erro ao criar tag:', error);
        const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor.';
        return NextResponse.json({ error: errorMessage, details: (error as Error).stack }, { status: 500 });
    }
}
