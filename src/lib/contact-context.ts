// src/lib/contact-context.ts
// Helper to build enriched contact context for AI agent prompts
// Includes: email, tags, contact lists, webhook form data (lead notes)

import { conn } from '@/lib/db';

const MAX_CONTEXT_CHARS = 2000; // ~500 tokens — accommodate larger forms

/**
 * Build enriched contact context string for injection into AI system prompt.
 * Queries tags, contact lists, email, and lead notes (form data from webhooks).
 */
export async function buildEnrichedContactContext(
    companyId: string,
    contactId: string,
    contactName: string,
    contactPhone: string
): Promise<string> {
    try {
        const lines: string[] = [
            `\n\nCONTEXTO DO CONTATO:`,
            `- Nome: ${contactName || 'Cliente'}`,
            `- Telefone: ${contactPhone}`,
        ];

        // 1. Fetch email and custom fields
        const contactResult = await conn`
      SELECT email, custom_fields FROM contacts 
      WHERE id = ${contactId} AND company_id = ${companyId} AND deleted_at IS NULL
      LIMIT 1
    `;
        const email = (contactResult as any)?.[0]?.email;
        const customFields = (contactResult as any)?.[0]?.custom_fields;
        if (email) {
            lines.push(`- Email: ${email}`);
        }

        // 1b. Inject structured custom fields (from webhook forms)
        if (customFields && typeof customFields === 'object' && Object.keys(customFields).length > 0) {
            lines.push(`\nDADOS DO FORMULÁRIO:`);
            for (const [key, value] of Object.entries(customFields)) {
                // Skip internal/system fields (FluentForms nonces, WP internals)
                if (key.startsWith('_')) continue;
                if (value && String(value).trim()) {
                    // Smart label normalization using known field map + generic fallback
                    const FIELD_LABEL_MAP: Record<string, string> = {
                        'datadenascimento': 'Data de Nascimento',
                        'datanascimento': 'Data de Nascimento',
                        'data_nascimento': 'Data de Nascimento',
                        'whatsapp': 'WhatsApp',
                        'profissao': 'Profissão',
                        'importante': 'O Mais Importante',
                        'investimento': 'Faixa de Investimento',
                        'objetivo': 'Objetivo',
                        'doenca': 'Doença',
                        'cirurgia': 'Cirurgia',
                        'nome': 'Nome',
                        'email': 'Email',
                        'telefone': 'Telefone',
                        'renda': 'Renda',
                        'cidade': 'Cidade',
                        'estado': 'Estado',
                        'sexo': 'Sexo',
                        'genero': 'Gênero',
                        'gender': 'Sexo',
                        'sex': 'Sexo',
                    };
                    const lowerKey = key.toLowerCase();
                    const displayLabel = FIELD_LABEL_MAP[lowerKey]
                        || key
                            .replace(/([A-Z])/g, ' $1')
                            .replace(/_/g, ' ')
                            .trim()
                            .replace(/^\w/, c => c.toUpperCase());
                    lines.push(`- ${displayLabel}: ${value}`);
                }
            }
        }

        // 2. Fetch tags
        const tagResult = await conn`
      SELECT t.name FROM tags t
      INNER JOIN contacts_to_tags ct ON ct.tag_id = t.id
      WHERE ct.contact_id = ${contactId} AND ct.company_id = ${companyId}
      ORDER BY t.created_at DESC
      LIMIT 5
    `;
        const tags = (tagResult as any[])?.map((r: any) => r.name).filter(Boolean);
        if (tags && tags.length > 0) {
            lines.push(`- Tags: ${tags.join(', ')}`);
            // Infer origin from first tag (webhook tags match webhook name)
            lines.push(`- Origem: ${tags[0]} (Webhook)`);
        }

        // 3. Fetch contact lists
        const listResult = await conn`
      SELECT cl.name FROM contact_lists cl
      INNER JOIN contacts_to_contact_lists ccl ON ccl.list_id = cl.id
      WHERE ccl.contact_id = ${contactId} AND ccl.company_id = ${companyId}
      ORDER BY cl.created_at DESC
      LIMIT 5
    `;
        const lists = (listResult as any[])?.map((r: any) => r.name).filter(Boolean);
        if (lists && lists.length > 0) {
            lines.push(`- Listas: ${lists.join(', ')}`);
        }

        // 4. Fetch lead notes (form data from webhook) — only if no custom_fields exist
        if (!customFields || Object.keys(customFields).length === 0) {
            const leadResult = await conn`
      SELECT notes FROM kanban_leads
      WHERE contact_id = ${contactId} AND company_id = ${companyId}
      ORDER BY created_at DESC
      LIMIT 1
    `;
            const notes = (leadResult as any)?.[0]?.notes;
            if (notes && notes.trim()) {
                // Truncate to avoid blowing up prompt
                const truncatedNotes = notes.length > 600 ? notes.substring(0, 600) + '...' : notes;
                lines.push(`\n${truncatedNotes}`);
            }
        }

        let result = lines.join('\n');

        // Safety cap
        if (result.length > MAX_CONTEXT_CHARS) {
            result = result.substring(0, MAX_CONTEXT_CHARS) + '...';
        }

        return result;
    } catch (error) {
        console.error('[ContactContext] Error building enriched context:', error);
        // Fallback to basic context
        return `\n\nCONTEXTO DO CONTATO:\n- Nome: ${contactName || 'Cliente'}\n- Telefone: ${contactPhone}`;
    }
}
