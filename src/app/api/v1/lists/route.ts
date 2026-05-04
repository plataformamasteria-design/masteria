

import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { contactLists, contactsToContactLists } from '@/lib/db/schema';
import { eq, desc, count, and, ilike, or, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import { getCompanyIdFromSession } from '@/app/actions';


const listSchema = z.object({
    name: z.string().min(1, 'Nome da lista é obrigatório'),
    description: z.string().optional(),
});


// GET /api/v1/lists - List all contact lists with counts

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const companyId = await getCompanyIdFromSession();
        const { searchParams } = new URL(request.url);

        const page = parseInt(searchParams.get('page') || '1', 10);
        const requestedLimit = parseInt(searchParams.get('limit') || '10', 10);
        
        if (requestedLimit < 0 || isNaN(requestedLimit)) {
            return NextResponse.json({ error: 'Limit inválido' }, { status: 400 });
        }

        const search = searchParams.get('search');
        const isPaginated = requestedLimit !== 0;
        const safetyMaxLimit = 10000;

        const whereClauses: (SQL | undefined)[] = [eq(contactLists.companyId, companyId)];

        if (search) {
            whereClauses.push(
                or(
                    ilike(contactLists.name, `%${search}%`),
                    ilike(contactLists.description, `%${search}%`)
                )
            );
        }

        const finalWhereClauses = and(...whereClauses.filter((c): c is SQL => !!c));

        const baseQuery = db
            .select({
                id: contactLists.id,
                name: contactLists.name,
                description: contactLists.description,
                createdAt: contactLists.createdAt,
                contactCount: count(contactsToContactLists.contactId),
            })
            .from(contactLists)
            .leftJoin(contactsToContactLists, eq(contactLists.id, contactsToContactLists.listId))
            .where(finalWhereClauses)
            .groupBy(contactLists.id)
            .orderBy(desc(contactLists.createdAt));

        const companyListsQuery = isPaginated
            ? baseQuery.limit(requestedLimit).offset((page - 1) * requestedLimit)
            : baseQuery.limit(safetyMaxLimit);

        const totalResult = await db
            .select({ count: count() })
            .from(contactLists)
            .where(finalWhereClauses);

        const companyLists = await companyListsQuery;
        const totalCount = totalResult[0]?.count ?? 0;
        const totalPages = isPaginated ? Math.ceil(totalCount / requestedLimit) : 1;

        return NextResponse.json({
            data: companyLists,
            totalPages,
        });
    } catch (error) {
        console.error('Erro ao buscar listas de contatos:', error);
        const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor.';
        return NextResponse.json({ error: errorMessage, details: (error as Error).stack }, { status: 500 });
    }
}

// POST /api/v1/lists - Create a new contact list
export async function POST(request: NextRequest) {
    try {
        const companyId = await getCompanyIdFromSession();
        const body = await request.json();
        const parsedData = listSchema.safeParse(body);

        if (!parsedData.success) {
            return NextResponse.json({ error: 'Dados inválidos.', details: parsedData.error.flatten() }, { status: 400 });
        }
        const { name, description } = parsedData.data;

        // VERIFICAÇÃO DE DUPLICATAS
        const [existing] = await db.select().from(contactLists).where(and(eq(contactLists.companyId, companyId), eq(contactLists.name, name)));
        if (existing) {
            return NextResponse.json({ error: 'Já existe uma lista com este nome.' }, { status: 409 });
        }

        const [newList] = await db.insert(contactLists).values({
            companyId,
            name,
            description,
        }).returning();

        return NextResponse.json(newList, { status: 201 });

    } catch (error) {
        console.error('Erro ao criar lista de contatos:', error);
        const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor.';
        return NextResponse.json({ error: errorMessage, details: (error as Error).stack }, { status: 500 });
    }
}
