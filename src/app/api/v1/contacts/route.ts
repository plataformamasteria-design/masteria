// src/app/api/v1/contacts/route.ts

import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { contacts, contactsToContactLists, contactsToTags } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { requireCompanyIdOr401, requireAuthWithUserOr401 } from '@/lib/api-auth-helper';
import { getCachedOrFetch, CacheTTL, apiCache } from '@/lib/api-cache';
import { sanitizePhone, canonicalizeBrazilPhone } from '@/lib/utils';

export const dynamic = 'force-dynamic';

// Pagination limit constants
const MAX_LIMIT = 50; // Maximum records per request to prevent performance issues
const DEFAULT_LIMIT = 10;

const contactCreateSchema = z.object({
    name: z.string().min(1, 'Nome é obrigatório').trim(),
    phone: z.string().min(10, 'Telefone inválido').trim(),
    email: z.preprocess(
        (val) => (val === '' || val === null || val === undefined) ? undefined : val,
        z.string().email('Email inválido').optional()
    ),
    avatarUrl: z.preprocess(
        (val) => (val === '' || val === null || val === undefined) ? undefined : val,
        z.string().url('URL de avatar inválida').optional()
    ),
    addressStreet: z.preprocess(
        (val) => (val === '' || val === null || val === undefined) ? undefined : val,
        z.string().optional()
    ),
    addressNumber: z.preprocess(
        (val) => (val === '' || val === null || val === undefined) ? undefined : val,
        z.string().optional()
    ),
    addressComplement: z.preprocess(
        (val) => (val === '' || val === null || val === undefined) ? undefined : val,
        z.string().optional()
    ),
    addressDistrict: z.preprocess(
        (val) => (val === '' || val === null || val === undefined) ? undefined : val,
        z.string().optional()
    ),
    addressCity: z.preprocess(
        (val) => (val === '' || val === null || val === undefined) ? undefined : val,
        z.string().optional()
    ),
    addressState: z.preprocess(
        (val) => (val === '' || val === null || val === undefined) ? undefined : val,
        z.string().optional()
    ),
    addressZipCode: z.preprocess(
        (val) => (val === '' || val === null || val === undefined) ? undefined : val,
        z.string().optional()
    ),
    notes: z.preprocess(
        (val) => (val === '' || val === null || val === undefined) ? undefined : val,
        z.string().optional()
    ),
    listIds: z.array(z.string()).optional().default([]),
    tagIds: z.array(z.string()).optional().default([]),
});


// GET /api/v1/contacts
export async function GET(request: NextRequest): Promise<NextResponse> {
    try {
        const authResult = await requireAuthWithUserOr401();
        if (authResult instanceof NextResponse) {
            return authResult; // Retorna 401 se não autenticado
        }
        const { companyId, user } = authResult;
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1', 10);
        // Enforce maximum limit to prevent performance issues
        const requestedLimit = parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT), 10);
        const limit = Math.min(requestedLimit, MAX_LIMIT);
        const search = searchParams.get('search');
        const sortBy = searchParams.get('sortBy') || 'createdAt';
        const sortOrder = searchParams.get('sortOrder') || 'desc';
        const tagId = searchParams.get('tagId');
        const listId = searchParams.get('listId');
        const listIds = searchParams.getAll('listIds');

        // Cache key baseado em todos os parâmetros + role do usuário (para não misturar cache de admin com atendente)
        const cacheKey = `contacts:${companyId}:${user.id}:${page}:${limit}:${search || ''}:${sortBy}:${sortOrder}:${tagId || ''}:${listId || ''}:${listIds.join(',')}`;

        // Buscar dados com cache (30 segundos - CacheTTL.SHORT)
        const data = await getCachedOrFetch(cacheKey, async () => {
            return await fetchContactsData({ companyId, user, page, limit, search, sortBy, sortOrder, tagId, listId, listIds });
        }, CacheTTL.SHORT);

        console.log(`[Contacts API] Returning ${data?.data?.length || 0} contacts out of ${data?.totalPages || 0} pages for company ${companyId}`);
        return NextResponse.json(data);
    } catch (error) {
        // Se já é uma resposta NextResponse (401), retorna diretamente
        if (error instanceof NextResponse) {
            return error;
        }
        console.error("Erro ao buscar contatos:", error);
        const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor.';
        return NextResponse.json({ error: errorMessage, details: (error as Error).stack }, { status: 500 });
    }
}

async function fetchContactsData(options: {
    companyId: string;
    user: any;
    page: number;
    limit: number;
    search: string | null;
    sortBy: string;
    sortOrder: string;
    tagId: string | null;
    listId: string | null;
    listIds: string[];
}) {
    const { companyId, user, page, limit, search, sortBy, sortOrder, tagId, listId, listIds } = options;
    const offset = (page - 1) * limit;

    // ✅ IMPORTANTE: Usar a mesma lógica SQL para contagem e dados para garantir consistência
    const sortableColumns = ['name', 'created_at'] as const;
    type SortableColumn = typeof sortableColumns[number];
    const columnMap: Record<string, SortableColumn> = {
        name: 'name',
        createdAt: 'created_at',
    };
    const orderByField = columnMap[sortBy] || 'created_at';
    const orderDirection = sortOrder === 'asc' ? 'asc' : 'desc';

    // Construir filtros WHERE dinâmicos (usados tanto para contagem quanto para dados)
    let whereConditions = sql`c.company_id = ${companyId}`;

    // Acesso à lista de contatos é global. Se o admin não quiser que o agente veja contatos, 
    // ele deve desabilitar a aba "Contatos" nas permissões do agente.
    // Filtrar contatos baseado em conversas (EXISTS) esconde contatos recém-criados.

    if (search) {
        const digitsOnlySearch = search.replace(/\D/g, '');
        if (digitsOnlySearch) {
            whereConditions = sql`${whereConditions} AND (c.name ILIKE ${`%${search}%`} OR c.email ILIKE ${`%${search}%`} OR c.phone ILIKE ${`%${digitsOnlySearch}%`})`;
        } else {
            whereConditions = sql`${whereConditions} AND (c.name ILIKE ${`%${search}%`} OR c.email ILIKE ${`%${search}%`})`;
        }
    }

    if (tagId && tagId !== 'all') {
        whereConditions = sql`${whereConditions} AND c.id IN (SELECT contact_id FROM contacts_to_tags WHERE tag_id = ${tagId})`;
    }

    if (listId && listId !== 'all') {
        whereConditions = sql`${whereConditions} AND c.id IN (SELECT contact_id FROM contacts_to_contact_lists WHERE list_id = ${listId})`;
    }

    if (listIds && listIds.length > 0) {
        whereConditions = sql`${whereConditions} AND c.id IN (SELECT DISTINCT contact_id FROM contacts_to_contact_lists WHERE list_id = ANY(${listIds}))`;
    }

    // Query de contagem usando a MESMA lógica SQL que a query de dados
    const countQuery = sql`
            SELECT COUNT(DISTINCT c.id) as value
            FROM contacts c
            WHERE ${whereConditions}
        `;

    // Query otimizada com LEFT JOIN + json_agg
    // ⚠️ IMPORTANTE: Aliases para manter camelCase e compatibilidade da API
    const dataQuery = sql`
            SELECT 
                c.id,
                c.company_id AS "companyId",
                c.name,
                c.whatsapp_name AS "whatsappName",
                c.phone,
                c.email,
                c.avatar_url AS "avatarUrl",
                c.status,
                c.notes,
                c.profile_last_synced_at AS "profileLastSyncedAt",
                c.address_street AS "addressStreet",
                c.address_number AS "addressNumber",
                c.address_complement AS "addressComplement",
                c.address_district AS "addressDistrict",
                c.address_city AS "addressCity",
                c.address_state AS "addressState",
                c.address_zip_code AS "addressZipCode",
                c.external_id AS "externalId",
                c.external_provider AS "externalProvider",
                c.created_at AS "createdAt",
                c.deleted_at AS "deletedAt",
                COALESCE(
                    json_agg(
                        DISTINCT jsonb_build_object(
                            'id', t.id, 
                            'name', t.name, 
                            'color', t.color
                        )
                    ) FILTER (WHERE t.id IS NOT NULL), 
                    '[]'
                ) as tags,
                COALESCE(
                    json_agg(
                        DISTINCT jsonb_build_object(
                            'id', cl.id, 
                            'name', cl.name
                        )
                    ) FILTER (WHERE cl.id IS NOT NULL), 
                    '[]'
                ) as lists
            FROM contacts c
            LEFT JOIN contacts_to_tags ctt ON c.id = ctt.contact_id
            LEFT JOIN tags t ON ctt.tag_id = t.id AND t.company_id = ${companyId}
            LEFT JOIN contacts_to_contact_lists ctcl ON c.id = ctcl.contact_id
            LEFT JOIN contact_lists cl ON ctcl.list_id = cl.id AND cl.company_id = ${companyId}
            WHERE ${whereConditions}
            GROUP BY c.id
            ORDER BY ${orderByField === 'name' ? sql`c.name` : sql`c.created_at`} ${orderDirection === 'asc' ? sql`ASC` : sql`DESC`}
            LIMIT ${limit} OFFSET ${offset}
        `;

    const [countResult, rawContactsResult] = await Promise.all([
        db.execute(countQuery),
        db.execute(dataQuery),
    ]);

    // Extrair contagem do resultado
    const totalContacts = Array.isArray(countResult) && countResult[0]
        ? Number(countResult[0].value)
        : 0;

    // ✅ db.execute() do Drizzle retorna um array diretamente (com metadados)
    // Type: Record<string, unknown>[] & Iterable & ResultQueryMeta
    const contactsWithRelations = Array.isArray(rawContactsResult)
        ? rawContactsResult
        : [];

    if (contactsWithRelations.length === 0 && totalContacts > 0) {
        console.warn('[fetchContactsData] Query retornou 0 contatos mas total é', totalContacts);
    }

    return {
        data: contactsWithRelations,
        totalPages: Math.ceil(totalContacts / limit),
    };
}


// POST /api/v1/contacts (para criação de contato único, não importação)
export async function POST(request: NextRequest): Promise<NextResponse> {
    let companyId = '';
    let body: any = {};
    try {
        const authResult = await requireCompanyIdOr401();
        if (authResult instanceof NextResponse) {
            return authResult; // Retorna 401 se não autenticado
        }
        companyId = authResult.companyId;
        body = await request.json();
        const parsed = contactCreateSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json({ error: 'Dados inválidos.', details: parsed.error.flatten() }, { status: 400 });
        }

        const { listIds, tagIds, ...contactData } = parsed.data;

        // Normalize phone number to canonical Brazilian format
        const sanitized = sanitizePhone(contactData.phone);
        const normalizedPhone = sanitized ? canonicalizeBrazilPhone(sanitized) : contactData.phone;

        const newContact = await db.transaction(async (tx) => {
            // Build insert object - ONLY include fields with values (never undefined)
            const insertValues: Record<string, any> = {
                name: contactData.name,
                phone: normalizedPhone,
                companyId,
            };

            // Conditionally add optional fields ONLY if defined
            // This prevents Drizzle from inserting 'default' for undefined fields
            if (contactData.email) insertValues.email = contactData.email;
            if (contactData.avatarUrl) insertValues.avatarUrl = contactData.avatarUrl;
            if (contactData.addressStreet) insertValues.addressStreet = contactData.addressStreet;
            if (contactData.addressNumber) insertValues.addressNumber = contactData.addressNumber;
            if (contactData.addressComplement) insertValues.addressComplement = contactData.addressComplement;
            if (contactData.addressDistrict) insertValues.addressDistrict = contactData.addressDistrict;
            if (contactData.addressCity) insertValues.addressCity = contactData.addressCity;
            if (contactData.addressState) insertValues.addressState = contactData.addressState;
            if (contactData.addressZipCode) insertValues.addressZipCode = contactData.addressZipCode;
            if (contactData.notes) insertValues.notes = contactData.notes;

            // Type-safe insert using partial values
            const [createdContact] = await tx
                .insert(contacts)
                .values(insertValues as any)
                .returning();

            if (!createdContact) {
                throw new Error("Falha ao criar o contato no banco de dados.");
            }

            // Insert tag relationships
            if (tagIds && tagIds.length > 0) {
                await tx.insert(contactsToTags).values(tagIds.map(tagId => ({
                    contactId: createdContact.id,
                    tagId
                })));
            }

            // Insert list relationships
            if (listIds && listIds.length > 0) {
                await tx.insert(contactsToContactLists).values(listIds.map(listId => ({
                    contactId: createdContact.id,
                    listId
                })));
            }

            return createdContact;
        });

        // Invalidar cache ao criar novo contato
        apiCache.invalidatePattern(`contacts:${companyId}`);

        return NextResponse.json(newContact, { status: 201 });
    } catch (error: any) {
        // Se já é uma resposta NextResponse (401), retorna diretamente
        if (error instanceof NextResponse) {
            return error;
        }
        // Handle Drizzle wrapped errors - the PostgresError is in error.cause
        const pgError = error.cause || error;
        const errorCode = pgError?.code || error?.code;
        const errorConstraint = pgError?.constraint || error?.constraint;

        // Check for duplicate phone number (unique constraint violation)
        if (errorCode === '23505' && (errorConstraint === 'contacts_phone_company_id_unique' || pgError?.detail?.includes('phone'))) {
            // Buscar contato existente para retornar o ID
            try {
                const phoneFromBody = body?.phone || '';
                const sanitizedPhone = sanitizePhone(phoneFromBody);
                const normalizedPhone = sanitizedPhone ? canonicalizeBrazilPhone(sanitizedPhone) : phoneFromBody;
                const { eq: eqOp, and: andOp } = await import('drizzle-orm');
                const [existingContact] = await db.select({ id: contacts.id })
                    .from(contacts)
                    .where(andOp(eqOp(contacts.phone, normalizedPhone), eqOp(contacts.companyId, companyId)))
                    .limit(1);
                return NextResponse.json({
                    error: 'Já existe um contato com este telefone.',
                    existingContactId: existingContact?.id || null,
                }, { status: 409 });
            } catch {
                return NextResponse.json({
                    error: 'Já existe um contato com este telefone.'
                }, { status: 409 });
            }
        }

        console.error("Erro ao criar contato:", error);
        const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor.';
        return NextResponse.json({ error: errorMessage, details: (error as Error).stack }, { status: 500 });
    }
}