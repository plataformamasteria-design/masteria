import { db } from './db';
import { contacts, contactLists, contactsToContactLists } from './db/schema';
import { eq, inArray, sql } from 'drizzle-orm';
import { resolveAIKeys } from './ai-keys-resolver';
import OpenAI from 'openai';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { canonicalizeBrazilPhone } from './utils';
import crypto from 'crypto';

interface MappedHeaders {
    phone: string | null;
    name: string | null;
    email: string | null;
    customFields: string[];
}

export class DocumentImportService {
    static async processDocument(
        companyId: string,
        mediaUrl: string,
        listName: string,
        mimeType: string | null = null
    ) {
        console.log(`[DOCUMENT-IMPORT] Iniciando download de ${mediaUrl}`);
        const response = await fetch(mediaUrl);
        
        if (!response.ok) {
            throw new Error(`Falha ao baixar o documento. HTTP Status: ${response.status}`);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const resolvedMime = mimeType || response.headers.get('content-type') || '';
        const urlLower = mediaUrl.toLowerCase();
        
        let data: Record<string, any>[] = [];
        let headers: string[] = [];

        // 1. Parsing Nativo
        if (resolvedMime.includes('csv') || urlLower.includes('.csv')) {
            const csvString = buffer.toString('utf-8');
            const parsed = Papa.parse(csvString, {
                header: true,
                skipEmptyLines: true,
                transformHeader: (h) => h.trim()
            });
            if (parsed.errors.length > 0 && parsed.data.length === 0) {
                throw new Error(`Erro ao interpretar CSV: ${parsed.errors[0].message}`);
            }
            data = parsed.data as Record<string, any>[];
            headers = parsed.meta.fields || Object.keys(data[0] || {});
        } else if (resolvedMime.includes('excel') || resolvedMime.includes('spreadsheet') || urlLower.includes('.xlsx') || urlLower.includes('.xls')) {
            const workbook = XLSX.read(buffer, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            data = XLSX.utils.sheet_to_json(sheet, { defval: "" });
            headers = data.length > 0 ? Object.keys(data[0]) : [];
        } else {
            throw new Error(`Formato de arquivo não suportado. Use CSV ou Excel. (Detectado: ${resolvedMime})`);
        }

        if (data.length === 0 || headers.length === 0) {
            throw new Error('O arquivo está vazio ou as colunas não puderam ser lidas corretamente.');
        }

        console.log(`[DOCUMENT-IMPORT] Arquivo interpretado: ${data.length} linhas, colunas: ${headers.join(', ')}`);

        // 2. Mapeamento de Colunas com IA
        const mappedHeaders = await this.mapHeadersWithAI(companyId, headers);
        
        if (!mappedHeaders.phone) {
            throw new Error(`Não foi possível identificar uma coluna de 'telefone' no documento. Colunas disponíveis: ${headers.join(', ')}`);
        }

        // 3. Preparar e Higienizar Dados
        const validContactsToInsert: any[] = [];
        const validPhonesSet = new Set<string>();

        for (const row of data) {
            const rawPhone = row[mappedHeaders.phone];
            if (!rawPhone) continue; // Ignora se não tem telefone na linha

            const canonicalPhone = canonicalizeBrazilPhone(String(rawPhone));
            if (!canonicalPhone || validPhonesSet.has(canonicalPhone)) continue; // Evita duplicados na mesma planilha
            
            validPhonesSet.add(canonicalPhone);

            const contactData: any = {
                id: crypto.randomUUID(),
                companyId,
                phone: canonicalPhone,
                status: 'ACTIVE',
                customFields: {}
            };

            if (mappedHeaders.name && row[mappedHeaders.name]) {
                contactData.name = String(row[mappedHeaders.name]).trim();
            } else {
                contactData.name = canonicalPhone; // Fallback
            }

            if (mappedHeaders.email && row[mappedHeaders.email]) {
                contactData.email = String(row[mappedHeaders.email]).trim();
            }

            // Mapeia o restante para customFields
            for (const cf of mappedHeaders.customFields) {
                if (row[cf] !== undefined && row[cf] !== null && row[cf] !== "") {
                    contactData.customFields[cf] = String(row[cf]).trim();
                }
            }

            validContactsToInsert.push(contactData);
        }

        if (validContactsToInsert.length === 0) {
            throw new Error('Nenhum contato válido com telefone foi encontrado na planilha após a filtragem.');
        }

        // 4. Inserção no Banco
        let listId = "";
        try {
            await db.transaction(async (tx) => {
                // Criar a lista
                const [newList] = await tx.insert(contactLists).values({
                    companyId,
                    name: listName,
                    description: `Lista importada via WhatsApp Copilot (${validContactsToInsert.length} leads)`,
                }).returning({ id: contactLists.id });
                
                listId = newList.id;

                // Inserir Contatos em Lotes de 500 para evitar limite de parâmetros do Postgres
                const BATCH_SIZE = 500;
                const contactIds: string[] = [];

                for (let i = 0; i < validContactsToInsert.length; i += BATCH_SIZE) {
                    const batch = validContactsToInsert.slice(i, i + BATCH_SIZE);
                    
                    const insertedBatch = await tx.insert(contacts)
                        .values(batch)
                        .onConflictDoUpdate({
                            target: [contacts.phone, contacts.companyId],
                            set: {
                                // Atualiza nome se fornecido, senão mantém
                                name: sql`COALESCE(EXCLUDED.name, contacts.name)`,
                                email: sql`COALESCE(EXCLUDED.email, contacts.email)`,
                                // Faz merge profundo dos custom fields usando JSONB
                                customFields: sql`contacts.custom_fields || EXCLUDED.custom_fields`
                            }
                        })
                        .returning({ id: contacts.id });
                    
                    contactIds.push(...insertedBatch.map(c => c.id));
                }

                // Inserir relação Contacts <-> ContactLists em lotes
                const pivotData = contactIds.map(cid => ({
                    companyId,
                    contactId: cid,
                    listId: newList.id
                }));

                for (let i = 0; i < pivotData.length; i += BATCH_SIZE) {
                    const batch = pivotData.slice(i, i + BATCH_SIZE);
                    await tx.insert(contactsToContactLists)
                        .values(batch)
                        .onConflictDoNothing(); // Ignora se a relação já existe
                }
            });
            
            console.log(`[DOCUMENT-IMPORT] Importação finalizada: ${validContactsToInsert.length} contatos inseridos na lista ${listName}`);
            
            return {
                success: true,
                importedCount: validContactsToInsert.length,
                listId
            };
            
        } catch (dbError: any) {
            console.error('[DOCUMENT-IMPORT] Erro ao persistir importação no banco:', dbError);
            throw new Error(`Falha ao salvar no banco de dados: ${dbError.message}`);
        }
    }

    private static async mapHeadersWithAI(companyId: string, headers: string[]): Promise<MappedHeaders> {
        const resolvedKeys = await resolveAIKeys(companyId);
        const OPENAI_KEY = resolvedKeys.openaiApiKey || process.env.OPENAI_API_KEY_AGENTS1 || process.env.OPENAI_API_KEY || '';

        if (!OPENAI_KEY) {
            throw new Error('Nenhuma chave da OpenAI configurada na empresa ou no ambiente para processar os cabeçalhos.');
        }

        const openai = new OpenAI({ apiKey: OPENAI_KEY });
        
        const systemPrompt = `Você é um analista de dados. Sua função é mapear colunas de uma planilha para os campos padrão de um CRM.
Campos Padrão do CRM:
- phone (telefone, celular, zap, whatsapp, numero, etc)
- name (nome, razao_social, nome do lead, etc)
- email (e-mail, correio eletronico, etc)

Regras:
1. Retorne ESTRITAMENTE um objeto JSON.
2. Identifique qual cabeçalho corresponde ao telefone. Esta é a coluna mais crítica.
3. Identifique qual cabeçalho corresponde ao nome e ao email.
4. Qualquer cabeçalho que não se encaixar em phone, name, ou email deve ser colocado na array "customFields".
5. Se não houver correspondência para name ou email, deixe como nulo. Mas phone deve ser mapeado se houver algo remotamente parecido.

Exemplo de Entrada: ["Telefone do Lead", "Nome", "Profissão", "Idade"]
Exemplo de Saída: {"phone": "Telefone do Lead", "name": "Nome", "email": null, "customFields": ["Profissão", "Idade"]}

Cabeçalhos da planilha: ${JSON.stringify(headers)}`;

        try {
            const response = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [{ role: "system", content: systemPrompt }],
                response_format: { type: "json_object" },
                temperature: 0.1
            });

            const content = response.choices[0].message.content;
            if (!content) throw new Error("IA retornou vazio");
            
            const parsed = JSON.parse(content);
            return {
                phone: parsed.phone || null,
                name: parsed.name || null,
                email: parsed.email || null,
                customFields: Array.isArray(parsed.customFields) ? parsed.customFields : []
            };
        } catch (e: any) {
            console.error('[DOCUMENT-IMPORT] Erro na IA ao mapear headers:', e);
            
            // Fallback manual tosko caso a IA caia
            const phoneMatch = headers.find(h => /tel|cel|phone|zap|whats|num|número/i.test(h));
            const nameMatch = headers.find(h => /nome|name|lead|cliente/i.test(h));
            const emailMatch = headers.find(h => /mail/i.test(h));
            
            const customFields = headers.filter(h => h !== phoneMatch && h !== nameMatch && h !== emailMatch);
            
            return {
                phone: phoneMatch || null,
                name: nameMatch || null,
                email: emailMatch || null,
                customFields
            };
        }
    }
}
