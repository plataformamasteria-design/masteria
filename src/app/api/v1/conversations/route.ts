// src/app/api/v1/conversations/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { conversations, contacts, messages, connections, usersToTeams } from '@/lib/db/schema';
import { eq, and, desc, sql, or, isNull, ilike, not, inArray, isNotNull } from 'drizzle-orm';
import { requireAuthWithUserOr401 } from '@/lib/api-auth-helper';
import { getCachedOrFetch, CacheTTL } from '@/lib/api-cache';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const authResult = await requireAuthWithUserOr401();
        if (authResult instanceof NextResponse) {
            return authResult; // Retorna 401 se não autenticado
        }
        const { companyId, userId, user } = authResult;

        const { searchParams } = new URL(request.url);
        const limitParam = searchParams.get('limit');
        const search = searchParams.get('search')?.trim() || '';
        let filterParam = searchParams.get('filter') || 'all';

        // Validação RBAC (Limitação de Visibilidade)
        if (user.role === 'atendente' && user.permissions?.viewMode === 'assigned_only') {
            // Se o agente está restrito, forçamos o filtro para mostrar APENAS os leads dele
            // mesmo se ele tentar acessar 'all', 'team', etc.
            if (filterParam !== 'resolved') {
                filterParam = 'mine';
            }
        }

        // Parse advanced filters
        const onlyUnread = searchParams.get('onlyUnread') === 'true';
        const awaitingResponse = searchParams.get('awaitingResponse') === 'true';
        const robotService = searchParams.get('robotService') === 'true';
        const filterTeamId = searchParams.get('filterTeamId') || null;
        const filterAgentId = searchParams.get('filterAgentId') || null;
        const filterTagId = searchParams.get('filterTagId') || null;
        const filterKanbanId = searchParams.get('filterKanbanId') || null;

        const SAFETY_CAP = 10000;
        let limit: number;

        if (limitParam === null) {
            limit = 50;
        } else if (limitParam === '0') {
            limit = SAFETY_CAP;
        } else {
            const parsedLimit = parseInt(limitParam, 10);
            limit = isNaN(parsedLimit) || parsedLimit < 0 ? 50 : Math.min(parsedLimit, SAFETY_CAP);
        }

        const offset = parseInt(searchParams.get('offset') || '0', 10);
        const advKey = `${onlyUnread}:${awaitingResponse}:${robotService}:${filterTeamId}:${filterAgentId}:${filterTagId}:${filterKanbanId}`;

        const tParam = searchParams.get('t');

        if (search) {
            const data = await fetchConversationsWithSearch(companyId, userId, search, limit, offset, filterParam, { onlyUnread, awaitingResponse, robotService, filterTeamId, filterAgentId, filterTagId, filterKanbanId });
            return NextResponse.json(data);
        }

        if (tParam) {
            // Bypass cache explicitly for polling and real-time updates
            const data = await fetchConversationsData(companyId, userId, limit, offset, filterParam, { onlyUnread, awaitingResponse, robotService, filterTeamId, filterAgentId, filterTagId, filterKanbanId });
            return NextResponse.json(data);
        }

        const cacheKey = `conversations:${companyId}:${userId}:${filterParam}:${advKey}:${limit}:${offset}`;
        const data = await getCachedOrFetch(cacheKey, async () => {
            return await fetchConversationsData(companyId, userId, limit, offset, filterParam, { onlyUnread, awaitingResponse, robotService, filterTeamId, filterAgentId, filterTagId, filterKanbanId });
        }, CacheTTL.SHORT);

        return NextResponse.json(data);
    } catch (error) {
        console.error('Erro ao buscar conversas:', error);
        // SECURITY: Never leak raw SQL to the frontend
        return NextResponse.json({ error: 'Erro interno ao buscar conversas.' }, { status: 500 });
    }
}

interface AdvFilters {
    onlyUnread: boolean;
    awaitingResponse: boolean;
    robotService: boolean;
    filterTeamId: string | null;
    filterAgentId: string | null;
    filterTagId: string | null;
    filterKanbanId: string | null;
}

const defaultAdv: AdvFilters = { onlyUnread: false, awaitingResponse: false, robotService: false, filterTeamId: null, filterAgentId: null, filterTagId: null, filterKanbanId: null };

// Helper local para resolver a baseCondition do switch Case
async function getBaseConditions(companyId: string, userId: string, filterParam: string, adv: AdvFilters = defaultAdv) {
    const base: any[] = [
        eq(conversations.companyId, companyId),
        or(eq(contacts.isGroup, false), isNull(contacts.isGroup))
    ];

    if (filterParam === 'mine') {
        base.push(
            eq(conversations.assignedTo, userId),
            not(eq(conversations.status, 'archived'))
        );
    } else if (filterParam === 'team') {
        try {
            const userTeamsResult = await db.select({ teamId: usersToTeams.teamId }).from(usersToTeams).where(eq(usersToTeams.userId, userId));
            const userTeamIds = userTeamsResult.map(t => t.teamId);
            if (userTeamIds.length > 0) {
                base.push(
                    inArray(conversations.teamId, userTeamIds),
                    not(eq(conversations.status, 'archived'))
                );
            } else {
                base.push(sql`false`);
            }
        } catch (err) {
            console.error('[Conversations API] Erro ao buscar teams:', err);
            base.push(
                isNotNull(conversations.teamId),
                not(eq(conversations.status, 'archived'))
            );
        }
    } else if (filterParam === 'resolved') {
        base.push(or(eq(conversations.status, 'archived'), eq(conversations.status, 'ARCHIVED'))!);
    } else {
        base.push(and(not(eq(conversations.status, 'archived')), not(eq(conversations.status, 'ARCHIVED')))!);
    }

    // Filtros avançados
    if (adv.robotService) {
        base.push(eq(conversations.aiActive, true));
    }
    if (adv.filterTeamId) {
        base.push(eq(conversations.teamId, adv.filterTeamId));
    }
    if (adv.filterAgentId) {
        base.push(eq(conversations.assignedTo, adv.filterAgentId));
    }
    if (adv.filterTagId) {
        base.push(sql`EXISTS (
            SELECT 1 FROM contacts_to_tags 
            WHERE contacts_to_tags.contact_id = conversations.contact_id 
            AND contacts_to_tags.tag_id = ${adv.filterTagId}
        )`);
    }
    if (adv.filterKanbanId) {
        base.push(sql`EXISTS (
            SELECT 1 FROM kanban_leads 
            WHERE kanban_leads.contact_id = conversations.contact_id 
            AND kanban_leads.board_id = ${adv.filterKanbanId}
        )`);
    }
    if (adv.awaitingResponse) {
        base.push(sql`(
            SELECT sender_type FROM messages 
            WHERE messages.conversation_id = conversations.id 
            AND messages.company_id = conversations.company_id
            ORDER BY messages.sent_at DESC LIMIT 1
        ) = 'CONTACT'`);
    }
    if (adv.onlyUnread) {
        base.push(sql`(
            SELECT status FROM messages
            WHERE messages.conversation_id = conversations.id 
            AND messages.company_id = conversations.company_id
            AND sender_type = 'CONTACT'
            ORDER BY messages.sent_at DESC LIMIT 1
        ) IS DISTINCT FROM 'read'`);
    }

    return base;
}

async function fetchConversationsData(companyId: string, userId: string, limit: number = 50, offset: number = 0, filterParam: string = 'all', adv: AdvFilters = defaultAdv) {
    const startTime = Date.now();
    const dynamicConditions = await getBaseConditions(companyId, userId, filterParam, adv);

    const companyConversations = await db.select({
        id: conversations.id,
        status: conversations.status,
        aiActive: conversations.aiActive,
        lastMessageAt: conversations.lastMessageAt,
        contactId: contacts.id,
        contactName: contacts.name,
        contactAvatar: contacts.avatarUrl,
        phone: contacts.phone,
        isGroup: contacts.isGroup,
        connectionName: connections.config_name,
        connectionType: connections.connectionType,
        source: conversations.source,
        assignedTo: conversations.assignedTo,
        teamId: conversations.teamId,
        assignedUserName: sql<string | null>`(
            SELECT users.name 
            FROM users 
            WHERE users.id = ${conversations.assignedTo}
        )`.as('assigned_user_name'),
        tags: sql<any>`(
            SELECT json_agg(json_build_object('id', tags.id, 'name', tags.name, 'color', tags.color))
            FROM contacts_to_tags 
            INNER JOIN tags ON contacts_to_tags.tag_id = tags.id 
            WHERE contacts_to_tags.contact_id = ${conversations.contactId}
        )`.as('tags'),
        lastMessage: sql<string | null>`(
                SELECT content 
                FROM ${messages} 
                WHERE ${messages.conversationId} = ${conversations.id} 
                AND ${messages.companyId} = ${conversations.companyId}
                ORDER BY ${messages.sentAt} DESC 
                LIMIT 1
            )`.as('last_message'),
        lastMessageStatus: sql<string | null>`(
                SELECT status 
                FROM ${messages} 
                WHERE ${messages.conversationId} = ${conversations.id} 
                AND ${messages.companyId} = ${conversations.companyId}
                ORDER BY ${messages.sentAt} DESC 
                LIMIT 1
            )`.as('last_message_status'),
        lastMessageSenderType: sql<string | null>`(
                SELECT sender_type 
                FROM ${messages} 
                WHERE ${messages.conversationId} = ${conversations.id} 
                AND ${messages.companyId} = ${conversations.companyId}
                ORDER BY ${messages.sentAt} DESC 
                LIMIT 1
            )`.as('last_message_sender_type'),
        contactActiveConversationsCount: sql<number>`1`.as('active_count'),
        kanbanBoardName: sql<string | null>`(
            SELECT kb.name FROM kanban_leads kl
            INNER JOIN kanban_boards kb ON kl.board_id = kb.id
            WHERE kl.contact_id = ${conversations.contactId}
            ORDER BY kl.updated_at DESC LIMIT 1
        )`.as('kanban_board_name'),
        kanbanStageName: sql<string | null>`(
            SELECT kl.current_stage->>'title' FROM kanban_leads kl
            WHERE kl.contact_id = ${conversations.contactId}
            ORDER BY kl.updated_at DESC LIMIT 1
        )`.as('kanban_stage_name'),
        kanbanStageType: sql<string | null>`(
            SELECT kl.current_stage->>'type' FROM kanban_leads kl
            WHERE kl.contact_id = ${conversations.contactId}
            ORDER BY kl.updated_at DESC LIMIT 1
        )`.as('kanban_stage_type'),
    })
        .from(conversations)
        .innerJoin(contacts, eq(conversations.contactId, contacts.id))
        .leftJoin(connections, eq(conversations.connectionId, connections.id))
        .where(and(...dynamicConditions))
        .orderBy(desc(conversations.lastMessageAt))
        .limit(limit)
        .offset(offset);

    const queryTime = Date.now() - startTime;

    const [totalCountResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(conversations)
        .innerJoin(contacts, eq(conversations.contactId, contacts.id))
        .where(and(...dynamicConditions));

    const totalCount = totalCountResult?.count || 0;
    const totalTime = Date.now() - startTime;

    console.log(`[Conversations API] ⚡ Fetch completed in ${totalTime}ms (query: ${queryTime}ms) | Rows: ${companyConversations.length}/${totalCount} | Limit: ${limit} | Offset: ${offset}`);

    return {
        data: companyConversations,
        total: totalCount,
        limit,
        offset
    };
}

async function fetchConversationsWithSearch(companyId: string, userId: string, searchTerm: string, limit: number = 50, offset: number = 0, filterParam: string = 'all', adv: AdvFilters = defaultAdv) {
    const startTime = Date.now();
    const searchPattern = `%${searchTerm}%`;
    const dynamicConditions = await getBaseConditions(companyId, userId, filterParam, adv);

    const companyConversations = await db.select({
        id: conversations.id,
        status: conversations.status,
        aiActive: conversations.aiActive,
        lastMessageAt: conversations.lastMessageAt,
        contactId: contacts.id,
        contactName: contacts.name,
        contactAvatar: contacts.avatarUrl,
        phone: contacts.phone,
        isGroup: contacts.isGroup,
        connectionName: connections.config_name,
        connectionType: connections.connectionType,
        source: conversations.source,
        assignedTo: conversations.assignedTo,
        teamId: conversations.teamId,
        assignedUserName: sql<string | null>`(
            SELECT users.name 
            FROM users 
            WHERE users.id = ${conversations.assignedTo}
        )`.as('assigned_user_name'),
        tags: sql<any>`(
            SELECT json_agg(json_build_object('id', tags.id, 'name', tags.name, 'color', tags.color))
            FROM contacts_to_tags 
            INNER JOIN tags ON contacts_to_tags.tag_id = tags.id 
            WHERE contacts_to_tags.contact_id = ${conversations.contactId}
        )`.as('tags'),
        lastMessage: sql<string | null>`(
            SELECT content 
            FROM ${messages} 
            WHERE ${messages.conversationId} = ${conversations.id} 
            AND ${messages.companyId} = ${conversations.companyId}
            ORDER BY ${messages.sentAt} DESC 
            LIMIT 1
        )`.as('last_message'),
        lastMessageStatus: sql<string | null>`(
            SELECT status 
            FROM ${messages} 
            WHERE ${messages.conversationId} = ${conversations.id} 
            AND ${messages.companyId} = ${conversations.companyId}
            ORDER BY ${messages.sentAt} DESC 
            LIMIT 1
        )`.as('last_message_status'),
        lastMessageSenderType: sql<string | null>`(
            SELECT sender_type 
            FROM ${messages} 
            WHERE ${messages.conversationId} = ${conversations.id} 
            AND ${messages.companyId} = ${conversations.companyId}
            ORDER BY ${messages.sentAt} DESC 
            LIMIT 1
        )`.as('last_message_sender_type'),
        contactActiveConversationsCount: sql<number>`1`.as('active_count'),
        kanbanBoardName: sql<string | null>`(
            SELECT kb.name FROM kanban_leads kl
            INNER JOIN kanban_boards kb ON kl.board_id = kb.id
            WHERE kl.contact_id = ${conversations.contactId}
            ORDER BY kl.updated_at DESC LIMIT 1
        )`.as('kanban_board_name_s'),
        kanbanStageName: sql<string | null>`(
            SELECT kl.current_stage->>'title' FROM kanban_leads kl
            WHERE kl.contact_id = ${conversations.contactId}
            ORDER BY kl.updated_at DESC LIMIT 1
        )`.as('kanban_stage_name_s'),
        kanbanStageType: sql<string | null>`(
            SELECT kl.current_stage->>'type' FROM kanban_leads kl
            WHERE kl.contact_id = ${conversations.contactId}
            ORDER BY kl.updated_at DESC LIMIT 1
        )`.as('kanban_stage_type_s'),
    })
        .from(conversations)
        .innerJoin(contacts, eq(conversations.contactId, contacts.id))
        .leftJoin(connections, eq(conversations.connectionId, connections.id))
        .where(and(
            ...dynamicConditions,
            or(
                ilike(contacts.name, searchPattern),
                ilike(contacts.phone, searchPattern),
                sql`EXISTS (
                SELECT 1 FROM ${messages} 
                WHERE ${messages.conversationId} = ${conversations.id} 
                AND ${messages.content} ILIKE ${searchPattern}
            )`
            )
        ))
        .orderBy(desc(conversations.lastMessageAt))
        .limit(limit)
        .offset(offset);

    const queryTime = Date.now() - startTime;

    const [totalCountResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(conversations)
        .innerJoin(contacts, eq(conversations.contactId, contacts.id))
        .where(and(
            ...dynamicConditions,
            or(
                ilike(contacts.name, searchPattern),
                ilike(contacts.phone, searchPattern),
                sql`EXISTS (
                    SELECT 1 FROM ${messages} 
                    WHERE ${messages.conversationId} = ${conversations.id} 
                    AND ${messages.content} ILIKE ${searchPattern}
                )`
            )
        ));

    const totalCount = totalCountResult?.count || 0;
    const totalTime = Date.now() - startTime;

    console.log(`[Conversations API] 🔍 Search "${searchTerm}" completed in ${totalTime}ms (query: ${queryTime}ms) | Rows: ${companyConversations.length}/${totalCount}`);

    return {
        data: companyConversations,
        total: totalCount,
        limit,
        offset,
        search: searchTerm
    };
}
