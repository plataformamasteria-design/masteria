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
        base.push(sql`EXISTS (
            SELECT 1 FROM messages m 
            WHERE m.conversation_id = conversations.id 
            AND m.company_id = conversations.company_id
            AND m.sender_type = 'CONTACT'
            AND m.sent_at = (SELECT MAX(sent_at) FROM messages WHERE conversation_id = conversations.id)
        )`);
    }
    if (adv.onlyUnread) {
        base.push(sql`EXISTS (
            SELECT 1 FROM messages m 
            WHERE m.conversation_id = conversations.id 
            AND m.company_id = conversations.company_id
            AND m.sender_type = 'CONTACT'
            AND m.status IS DISTINCT FROM 'read'
            AND m.sent_at = (SELECT MAX(sent_at) FROM messages WHERE conversation_id = conversations.id)
        )`);
    }

    return base;
}

async function fetchConversationsData(companyId: string, userId: string, limit: number = 50, offset: number = 0, filterParam: string = 'all', adv: AdvFilters = defaultAdv) {
    const startTime = Date.now();
    const dynamicConditions = await getBaseConditions(companyId, userId, filterParam, adv);

    // Passo 1: Buscar apenas os IDs e base de forma rápida
    const baseConvos = await db.select({ id: conversations.id })
        .from(conversations)
        .innerJoin(contacts, eq(conversations.contactId, contacts.id))
        .where(and(...dynamicConditions))
        .orderBy(desc(conversations.lastMessageAt))
        .limit(limit)
        .offset(offset);

    if (baseConvos.length === 0) {
        return { data: [], total: 0, limit, offset };
    }

    const convoIds = baseConvos.map(c => c.id);

    // Passo 2: Buscar dados completos apenas para a página selecionada
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
        lastMessageData: sql<any>`(
            SELECT json_build_object(
                'content', content,
                'status', status,
                'sender_type', sender_type
            )
            FROM ${messages} 
            WHERE ${messages.conversationId} = ${conversations.id} 
            AND ${messages.companyId} = ${conversations.companyId}
            ORDER BY ${messages.sentAt} DESC 
            LIMIT 1
        )`.as('last_message_data'),
        contactActiveConversationsCount: sql<number>`1`.as('active_count'),
        kanbanData: sql<any>`(
            SELECT json_build_object(
                'boardName', kb.name,
                'stageName', kl.current_stage->>'title',
                'stageType', kl.current_stage->>'type'
            )
            FROM kanban_leads kl
            INNER JOIN kanban_boards kb ON kl.board_id = kb.id
            WHERE kl.contact_id = ${conversations.contactId}
            ORDER BY kl.updated_at DESC LIMIT 1
        )`.as('kanban_data'),
    })
        .from(conversations)
        .innerJoin(contacts, eq(conversations.contactId, contacts.id))
        .leftJoin(connections, eq(conversations.connectionId, connections.id))
        .where(inArray(conversations.id, convoIds))
        .orderBy(desc(conversations.lastMessageAt));

    const queryTime = Date.now() - startTime;
    
    // Mapeamento em memória para preservar compatibilidade de interface
    const formattedData = companyConversations.map(conv => ({
        ...conv,
        lastMessage: conv.lastMessageData?.content || null,
        lastMessageStatus: conv.lastMessageData?.status || null,
        lastMessageSenderType: conv.lastMessageData?.sender_type || null,
        kanbanBoardName: conv.kanbanData?.boardName || null,
        kanbanStageName: conv.kanbanData?.stageName || null,
        kanbanStageType: conv.kanbanData?.stageType || null,
        lastMessageData: undefined,
        kanbanData: undefined
    }));

    console.log(`[Conversations API] ⚡ Two-Step Fetch completed in ${queryTime}ms | Rows: ${formattedData.length} | Limit: ${limit} | Offset: ${offset}`);

    return {
        data: formattedData,
        total: 0, // Ignorado pelo client, economia de 1 query pesada
        limit,
        offset
    };
}

async function fetchConversationsWithSearch(companyId: string, userId: string, searchTerm: string, limit: number = 50, offset: number = 0, filterParam: string = 'all', adv: AdvFilters = defaultAdv) {
    const startTime = Date.now();
    const searchPattern = `%${searchTerm}%`;
    const dynamicConditions = await getBaseConditions(companyId, userId, filterParam, adv);

    // Passo 1: Busca base rápida com filtros
    const baseConvos = await db.select({ id: conversations.id })
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
        ))
        .orderBy(desc(conversations.lastMessageAt))
        .limit(limit)
        .offset(offset);

    if (baseConvos.length === 0) {
        return { data: [], total: 0, limit, offset, search: searchTerm };
    }

    const convoIds = baseConvos.map(c => c.id);

    // Passo 2: Carga rica apenas para a página
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
        lastMessageData: sql<any>`(
            SELECT json_build_object(
                'content', content,
                'status', status,
                'sender_type', sender_type
            )
            FROM ${messages} 
            WHERE ${messages.conversationId} = ${conversations.id} 
            AND ${messages.companyId} = ${conversations.companyId}
            ORDER BY ${messages.sentAt} DESC 
            LIMIT 1
        )`.as('last_message_data'),
        contactActiveConversationsCount: sql<number>`1`.as('active_count'),
        kanbanData: sql<any>`(
            SELECT json_build_object(
                'boardName', kb.name,
                'stageName', kl.current_stage->>'title',
                'stageType', kl.current_stage->>'type'
            )
            FROM kanban_leads kl
            INNER JOIN kanban_boards kb ON kl.board_id = kb.id
            WHERE kl.contact_id = ${conversations.contactId}
            ORDER BY kl.updated_at DESC LIMIT 1
        )`.as('kanban_data_s'),
    })
        .from(conversations)
        .innerJoin(contacts, eq(conversations.contactId, contacts.id))
        .leftJoin(connections, eq(conversations.connectionId, connections.id))
        .where(inArray(conversations.id, convoIds))
        .orderBy(desc(conversations.lastMessageAt));

    const queryTime = Date.now() - startTime;
    
    const formattedData = companyConversations.map(conv => ({
        ...conv,
        lastMessage: conv.lastMessageData?.content || null,
        lastMessageStatus: conv.lastMessageData?.status || null,
        lastMessageSenderType: conv.lastMessageData?.sender_type || null,
        kanbanBoardName: conv.kanbanData?.boardName || null,
        kanbanStageName: conv.kanbanData?.stageName || null,
        kanbanStageType: conv.kanbanData?.stageType || null,
        lastMessageData: undefined,
        kanbanData: undefined
    }));

    console.log(`[Conversations API] 🔍 Two-Step Search "${searchTerm}" completed in ${queryTime}ms | Rows: ${formattedData.length}`);

    return {
        data: formattedData,
        total: 0,
        limit,
        offset,
        search: searchTerm
    };
}
