import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { contacts, contactsToContactLists, smsGateways } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { decrypt } from '@/lib/crypto';
import { getCompanyIdFromSession } from '@/app/actions';

const MKOM_ENDPOINT = 'https://sms.mkmservice.com/sms/api/transmission/v1';

interface MkomMessage {
    msisdn: string;
    message: string;
    reference: string;
}

interface MkomPayload {
    mailing: {
        identifier: string;
        cost_centre_id?: string;
    };
    messages: MkomMessage[];
}

export async function POST(request: NextRequest) {
    const startTime = Date.now();
    const evidences: Record<string, unknown> = {
        timestamp: new Date().toISOString(),
        test_id: `test_${Date.now()}`
    };

    try {
        const companyId = await getCompanyIdFromSession();
        const body = await request.json();
        const { listId, message, gatewayId } = body;

        evidences.input = { listId, message: message?.substring(0, 50) + '...', gatewayId };

        if (!listId || !message || !gatewayId) {
            return NextResponse.json({
                success: false,
                error: 'Parâmetros obrigatórios: listId, message, gatewayId',
                evidences
            }, { status: 400 });
        }

        // SECURITY: Validar tenant ao buscar gateway
        const [gateway] = await db.select().from(smsGateways).where(and(
            eq(smsGateways.id, gatewayId),
            eq(smsGateways.companyId, companyId)
        ));
        if (!gateway) {
            return NextResponse.json({
                success: false,
                error: 'Gateway não encontrado',
                evidences
            }, { status: 404 });
        }

        evidences.gateway = {
            id: gateway.id,
            name: gateway.name,
            provider: gateway.provider,
            is_active: gateway.isActive
        };

        const contactsData = await db
            .select({
                id: contacts.id,
                name: contacts.name,
                phone: contacts.phone
            })
            .from(contacts)
            .innerJoin(contactsToContactLists, eq(contacts.id, contactsToContactLists.contactId))
            .where(eq(contactsToContactLists.listId, listId));

        evidences.contacts_found = contactsData.length;
        evidences.contacts_raw = contactsData.map(c => ({
            id: c.id,
            name: c.name,
            phone_original: c.phone
        }));

        if (contactsData.length === 0) {
            return NextResponse.json({
                success: false,
                error: 'Nenhum contato encontrado na lista',
                evidences
            }, { status: 404 });
        }

        let token: string;
        try {
            const credentials = gateway.credentials as { token?: string };
            if (!credentials?.token) {
                throw new Error('Token não encontrado nas credenciais');
            }
            token = decrypt(credentials.token);
            evidences.token_decrypted = true;
            evidences.token_preview = token.substring(0, 20) + '...';
        } catch (error) {
            evidences.token_error = (error as Error).message;
            return NextResponse.json({
                success: false,
                error: 'Erro ao descriptografar token',
                evidences
            }, { status: 500 });
        }

        const normalizePhone = (phone: string): string => {
            let cleaned = phone.replace(/\D/g, '');
            if (!cleaned.startsWith('55')) {
                cleaned = '55' + cleaned;
            }
            return cleaned;
        };

        const messages: MkomMessage[] = contactsData.map(contact => ({
            msisdn: normalizePhone(contact.phone || ''),
            message: message,
            reference: contact.id
        }));

        evidences.messages_prepared = messages.map(m => ({
            msisdn: m.msisdn,
            msisdn_length: m.msisdn.length,
            reference: m.reference,
            message_length: m.message.length
        }));

        const mailingId = `test_${Date.now()}`;
        const costCentreId = (gateway.credentials as { cost_centre_id?: string })?.cost_centre_id;

        const mkomPayload: MkomPayload = {
            mailing: {
                identifier: mailingId,
                ...(costCentreId && { cost_centre_id: costCentreId })
            },
            messages
        };

        evidences.mkom_request = {
            endpoint: MKOM_ENDPOINT,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token.substring(0, 10)}...`
            },
            payload: {
                mailing: mkomPayload.mailing,
                messages_count: mkomPayload.messages.length,
                messages_preview: mkomPayload.messages.slice(0, 3)
            }
        };

        console.log('='.repeat(80));
        console.log('[SMS TEST] 🧪 INICIANDO TESTE DE ENVIO MKOM');
        console.log('='.repeat(80));
        console.log('[SMS TEST] 📡 Endpoint:', MKOM_ENDPOINT);
        console.log('[SMS TEST] 📨 Mensagens:', messages.length);
        console.log('[SMS TEST] 📋 Payload:', JSON.stringify(mkomPayload, null, 2));

        let mkomResponse: Response;
        let mkomResponseText: string;
        let mkomResponseData: unknown;

        try {
            const fetchStart = Date.now();
            mkomResponse = await fetch(MKOM_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(mkomPayload),
                signal: AbortSignal.timeout(30000)
            });
            const fetchDuration = Date.now() - fetchStart;

            mkomResponseText = await mkomResponse.text();
            
            evidences.mkom_response = {
                status: mkomResponse.status,
                statusText: mkomResponse.statusText,
                headers: Object.fromEntries(mkomResponse.headers.entries()),
                duration_ms: fetchDuration,
                body_raw: mkomResponseText
            };

            console.log('[SMS TEST] 📥 Response Status:', mkomResponse.status, mkomResponse.statusText);
            console.log('[SMS TEST] 📥 Response Headers:', JSON.stringify(Object.fromEntries(mkomResponse.headers.entries()), null, 2));
            console.log('[SMS TEST] 📥 Response Body:', mkomResponseText);

            try {
                mkomResponseData = JSON.parse(mkomResponseText);
                evidences.mkom_response_parsed = mkomResponseData;
            } catch {
                evidences.mkom_response_parse_error = 'Response não é JSON válido';
            }

        } catch (fetchError) {
            evidences.mkom_fetch_error = {
                message: (fetchError as Error).message,
                name: (fetchError as Error).name
            };
            console.error('[SMS TEST] ❌ Erro na requisição MKOM:', fetchError);
            
            return NextResponse.json({
                success: false,
                error: 'Erro na requisição para API MKOM',
                evidences,
                duration_ms: Date.now() - startTime
            }, { status: 500 });
        }

        const processedResults: Array<{
            contact_id: string;
            contact_name: string;
            phone: string;
            status: string;
            provider_response?: unknown;
        }> = [];

        const sentContactIds = new Set(messages.map(m => m.reference));
        
        if (mkomResponseData && typeof mkomResponseData === 'object') {
            const data = mkomResponseData as Record<string, unknown>;
            const responseMessages = data.messages as Array<Record<string, unknown>> || [];
            
            for (const msg of responseMessages) {
                const reference = msg.reference;
                if (typeof reference !== 'string' || !reference || !sentContactIds.has(reference)) {
                    continue;
                }

                const contact = contactsData.find(c => c.id === reference);
                const success = msg.success === true;
                const status = typeof msg.status === 'string' ? msg.status : (success ? 'SENT' : 'FAILED');

                processedResults.push({
                    contact_id: reference,
                    contact_name: contact?.name || 'Unknown',
                    phone: contact?.phone || '',
                    status,
                    provider_response: msg
                });

                sentContactIds.delete(reference);
            }

            for (const missingId of sentContactIds) {
                const contact = contactsData.find(c => c.id === missingId);
                processedResults.push({
                    contact_id: missingId,
                    contact_name: contact?.name || 'Unknown',
                    phone: contact?.phone || '',
                    status: 'NO_RESPONSE',
                    provider_response: null
                });
            }
        }

        evidences.processed_results = processedResults;
        evidences.summary = {
            total_contacts: contactsData.length,
            sent_count: processedResults.filter(r => r.status === 'SENT' || r.status === 'DELIVERED').length,
            failed_count: processedResults.filter(r => r.status === 'FAILED').length,
            no_response_count: processedResults.filter(r => r.status === 'NO_RESPONSE').length
        };

        console.log('[SMS TEST] 📊 Resultados processados:', JSON.stringify(processedResults, null, 2));
        console.log('[SMS TEST] 📊 Resumo:', JSON.stringify(evidences.summary, null, 2));
        console.log('='.repeat(80));
        console.log('[SMS TEST] ✅ TESTE CONCLUÍDO');
        console.log('='.repeat(80));

        return NextResponse.json({
            success: mkomResponse.ok,
            test_id: evidences.test_id,
            duration_ms: Date.now() - startTime,
            evidences
        });

    } catch (error) {
        console.error('[SMS TEST] ❌ Erro geral:', error);
        evidences.general_error = {
            message: (error as Error).message,
            stack: (error as Error).stack
        };

        return NextResponse.json({
            success: false,
            error: (error as Error).message,
            evidences,
            duration_ms: Date.now() - startTime
        }, { status: 500 });
    }
}
