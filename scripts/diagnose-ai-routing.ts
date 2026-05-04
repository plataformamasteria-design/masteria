/**
 * diagnose-ai-routing.ts
 * 
 * Script de diagnóstico para investigar por que agentes IA não estão respondendo
 * mensagens recebidas via CloudAPI/Meta API.
 * 
 * Uso: npx tsx scripts/diagnose-ai-routing.ts --connection="1302_diego_ia_seller"
 *      npx tsx scripts/diagnose-ai-routing.ts --phone="1024187224101997"
 */

import { db } from '../src/lib/db';
import {
    connections,
    conversations,
    messages,
    contacts,
    aiPersonas,
    kanbanLeads,
    kanbanBoards,
    kanbanStagePersonas,
    automationLogs
} from '../src/lib/db/schema';
import { eq, and, desc, like, or, isNull, sql } from 'drizzle-orm';

// Parse command line arguments
const args = process.argv.slice(2);
let connectionName = '';
let phoneNumberId = '';

for (const arg of args) {
    if (arg.startsWith('--connection=')) {
        connectionName = arg.split('=')[1];
    } else if (arg.startsWith('--phone=')) {
        phoneNumberId = arg.split('=')[1];
    }
}

async function main() {
    console.log('='.repeat(80));
    console.log('🔍 DIAGNÓSTICO DE ROTEAMENTO DE IA');
    console.log('='.repeat(80));
    console.log();

    // 1. Buscar conexão
    console.log('📡 ETAPA 1: Buscando conexão...');
    console.log('-'.repeat(40));

    let connectionQuery = db.select().from(connections);

    if (connectionName) {
        connectionQuery = connectionQuery.where(like(connections.config_name, `%${connectionName}%`)) as any;
    } else if (phoneNumberId) {
        connectionQuery = connectionQuery.where(eq(connections.phoneNumberId, phoneNumberId)) as any;
    } else {
        // Se não foi passado argumento, listar todas as conexões CloudAPI/meta_api
        console.log('⚠️  Nenhum filtro especificado. Listando conexões meta_api/apicloud...');
        connectionQuery = connectionQuery.where(
            or(
                eq(connections.connectionType, 'meta_api'),
                eq(connections.connectionType, 'apicloud')
            )
        ) as any;
    }

    const foundConnections = await connectionQuery.limit(10);

    if (foundConnections.length === 0) {
        console.log('❌ Nenhuma conexão encontrada com os critérios especificados.');
        process.exit(1);
    }

    console.log(`✅ ${foundConnections.length} conexão(ões) encontrada(s):\n`);

    for (const conn of foundConnections) {
        console.log(`  📱 ${conn.config_name}`);
        console.log(`     ID: ${conn.id}`);
        console.log(`     Phone Number ID: ${conn.phoneNumberId || '(não configurado)'}`);
        console.log(`     Tipo: ${conn.connectionType}`);
        console.log(`     Ativa: ${conn.isActive ? '✅ Sim' : '❌ Não'}`);
        console.log(`     assignedPersonaId: ${conn.assignedPersonaId || '⚠️ NULL (PROBLEMA!)'}`);
        console.log();
    }

    // 2. Para cada conexão, verificar a persona configurada
    console.log('🤖 ETAPA 2: Verificando personas configuradas...');
    console.log('-'.repeat(40));

    for (const conn of foundConnections) {
        if (!conn.assignedPersonaId) {
            console.log(`❌ Conexão "${conn.config_name}" NÃO tem assignedPersonaId configurado!`);
            console.log(`   ➡️ Isso significa que 'hasRoutingConfigured' será FALSE no automation-engine.`);
            console.log(`   ➡️ Se 'aiActive' também for FALSE na conversa, a IA NÃO responderá.`);
            console.log();
            continue;
        }

        const persona = await db.select().from(aiPersonas)
            .where(eq(aiPersonas.id, conn.assignedPersonaId))
            .limit(1);

        if (persona.length === 0) {
            console.log(`⚠️ Conexão "${conn.config_name}" tem assignedPersonaId='${conn.assignedPersonaId}'`);
            console.log(`   MAS essa persona NÃO EXISTE no banco de dados!`);
            console.log();
        } else {
            console.log(`✅ Conexão "${conn.config_name}" configurada para persona:`);
            console.log(`   Nome: ${persona[0].name}`);
            console.log(`   ID: ${persona[0].id}`);
            console.log(`   Ativa: ${persona[0].isActive ? '✅' : '❌'}`);
            console.log();
        }
    }

    // 3. Buscar conversas recentes e verificar aiActive
    console.log('💬 ETAPA 3: Verificando conversas recentes...');
    console.log('-'.repeat(40));

    for (const conn of foundConnections) {
        const recentConversations = await db.select({
            id: conversations.id,
            contactId: conversations.contactId,
            aiActive: conversations.aiActive,
            status: conversations.status,
            lastMessageAt: conversations.lastMessageAt,
            assignedPersonaId: conversations.assignedPersonaId
        })
            .from(conversations)
            .where(eq(conversations.connectionId, conn.id))
            .orderBy(desc(conversations.lastMessageAt))
            .limit(5);

        console.log(`\n🔗 Conexão: ${conn.config_name} (${recentConversations.length} conversas recentes)`);

        if (recentConversations.length === 0) {
            console.log('   Nenhuma conversa encontrada para esta conexão.');
            continue;
        }

        for (const convo of recentConversations) {
            const contact = await db.select({ name: contacts.name, phone: contacts.phone })
                .from(contacts)
                .where(eq(contacts.id, convo.contactId))
                .limit(1);

            const contactInfo = contact[0] ? `${contact[0].name} (${contact[0].phone})` : 'Desconhecido';

            console.log(`\n   📞 Conversa: ${convo.id.substring(0, 8)}...`);
            console.log(`      Contato: ${contactInfo}`);
            console.log(`      aiActive: ${convo.aiActive ? '✅ TRUE' : '❌ FALSE'}`);
            console.log(`      Status: ${convo.status}`);
            console.log(`      assignedPersonaId (conversa): ${convo.assignedPersonaId || 'null'}`);
            console.log(`      Última msg: ${convo.lastMessageAt?.toISOString() || 'N/A'}`);

            // Verificar lógica de decisão
            const hasRoutingConfigured = !!conn.assignedPersonaId;
            const willProcessAI = hasRoutingConfigured || convo.aiActive;

            console.log(`      ---`);
            console.log(`      🧮 hasRoutingConfigured: ${hasRoutingConfigured}`);
            console.log(`      🧮 aiActive: ${convo.aiActive}`);
            console.log(`      🧮 RESULTADO: ${willProcessAI ? '✅ IA SERÁ PROCESSADA' : '❌ IA NÃO SERÁ PROCESSADA'}`);

            // Verificar se contato tem lead no Kanban
            if (contact[0]) {
                const lead = await db.select({
                    id: kanbanLeads.id,
                    boardId: kanbanLeads.boardId,
                    stageId: kanbanLeads.stageId
                })
                    .from(kanbanLeads)
                    .where(eq(kanbanLeads.contactId, convo.contactId))
                    .limit(1);

                if (lead.length > 0) {
                    console.log(`      📊 Lead no Kanban: Sim (Board: ${lead[0].boardId.substring(0, 8)}..., Stage: ${lead[0].stageId})`);

                    // Verificar configuração de persona por estágio
                    const stageConfig = await db.select()
                        .from(kanbanStagePersonas)
                        .where(and(
                            eq(kanbanStagePersonas.boardId, lead[0].boardId),
                            eq(kanbanStagePersonas.stageId, lead[0].stageId)
                        ))
                        .limit(1);

                    if (stageConfig.length > 0) {
                        console.log(`      📊 Config de estágio: activePersonaId=${stageConfig[0].activePersonaId}, passivePersonaId=${stageConfig[0].passivePersonaId}`);
                    } else {
                        console.log(`      📊 Config de estágio: Nenhuma (fallback para conexão)`);
                    }
                } else {
                    console.log(`      📊 Lead no Kanban: Não (fallback para conexão)`);
                }
            }
        }
    }

    // 4. Verificar logs de automação recentes
    console.log('\n');
    console.log('📋 ETAPA 4: Logs de automação recentes...');
    console.log('-'.repeat(40));

    const recentLogs = await db.select({
        level: automationLogs.level,
        message: automationLogs.message,
        conversationId: automationLogs.conversationId,
        createdAt: automationLogs.createdAt
    })
        .from(automationLogs)
        .where(sql`${automationLogs.createdAt} > NOW() - INTERVAL '2 hours'`)
        .orderBy(desc(automationLogs.createdAt))
        .limit(30);

    if (recentLogs.length === 0) {
        console.log('⚠️ Nenhum log de automação nas últimas 2 horas.');
    } else {
        console.log(`📝 ${recentLogs.length} logs encontrados:\n`);

        for (const log of recentLogs.slice(0, 15)) {
            const time = log.createdAt?.toISOString().substring(11, 19) || 'N/A';
            const level = log.level === 'ERROR' ? '❌' : log.level === 'WARN' ? '⚠️' : 'ℹ️';
            const msg = (log.message || '').substring(0, 80);
            console.log(`  [${time}] ${level} ${msg}${(log.message?.length || 0) > 80 ? '...' : ''}`);
        }
    }

    // 5. Resumo e recomendações
    console.log('\n');
    console.log('='.repeat(80));
    console.log('📊 RESUMO E RECOMENDAÇÕES');
    console.log('='.repeat(80));

    let issues = 0;
    for (const conn of foundConnections) {
        if (!conn.assignedPersonaId) {
            console.log(`\n❌ PROBLEMA: Conexão "${conn.config_name}" sem assignedPersonaId`);
            console.log(`   SOLUÇÃO: Configure um agente IA em /roteamento para esta conexão.`);
            issues++;
        }
        if (!conn.isActive) {
            console.log(`\n⚠️ AVISO: Conexão "${conn.config_name}" está inativa`);
            console.log(`   SOLUÇÃO: Ative a conexão nas configurações.`);
            issues++;
        }
    }

    if (issues === 0) {
        console.log('\n✅ Nenhum problema óbvio encontrado nas conexões.');
        console.log('   Se a IA ainda não responde, verifique:');
        console.log('   1. Se aiActive=FALSE nas conversas e não há roteamento');
        console.log('   2. Se há regras de automação enviando mensagem (bloqueia IA)');
        console.log('   3. Se a persona está ativa e com API key configurada');
        console.log('   4. Logs do servidor em tempo real durante teste');
    }

    console.log('\n');
    process.exit(0);
}

main().catch(err => {
    console.error('❌ Erro fatal:', err);
    process.exit(1);
});
