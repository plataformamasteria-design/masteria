import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { contacts, contactsToContactLists, contactsToTags } from '@/lib/db/schema';
import { inArray, eq, and } from 'drizzle-orm';
import { getCompanyIdFromSession } from '@/app/actions';
import { sanitizePhone, canonicalizeBrazilPhone } from '@/lib/utils';

interface RequestBody {
  chunk: Record<string, any>[];
  mappings: Record<string, string>;
  lists: string[];
  tags: string[];
  updateExisting: boolean;
}

function sanitizeString(input: any, maxLength = 255): string | null {
    if (input === null || input === undefined) {
      return null;
    }
    const str = String(input).trim();
    if (str === '' || str.toLowerCase() === 'default') {
      return null;
    }
    return str.slice(0, maxLength);
}


// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const companyId = await getCompanyIdFromSession();
    const {
        chunk,
        mappings,
        lists: listIds,
        tags: tagIds,
        updateExisting
    } = await request.json() as RequestBody;

    if (!chunk || !Array.isArray(chunk)) {
        return NextResponse.json({ error: 'Lote de dados (chunk) inválido.' }, { status: 400 });
    }
    if (!mappings || !mappings.phone || !mappings.name) {
        return NextResponse.json({ error: 'Mapeamentos obrigatórios de Nome e Telefone ausentes.' }, { status: 400 });
    }

    const summary = { created: 0, updated: 0, ignored: 0, errors: 0 };
    
    if (chunk.length === 0) {
        return NextResponse.json({ success: true, summary });
    }
    
    const processedPhonesInChunk = new Set<string>();
    
    const phoneColumn = mappings.phone;
    const phoneNumbersInChunk = chunk
      .map(row => {
        const sanitized = sanitizePhone(row[phoneColumn]);
        return sanitized ? canonicalizeBrazilPhone(sanitized) : null;
      })
      .filter(p => p !== null) as string[];
    
    const existingContacts = phoneNumbersInChunk.length > 0 ? await db
      .select({ id: contacts.id, phone: contacts.phone })
      .from(contacts)
      .where(and(eq(contacts.companyId, companyId), inArray(contacts.phone, phoneNumbersInChunk))) : [];

    const existingContactsMap = new Map(existingContacts.map(c => [c.phone, c.id]));
    
    const updatedContactIds: string[] = [];
    const newContactsToInsert: any[] = [];
    const allContactsToAssociate: string[] = [];


    for (const rawData of chunk) {
        const sanitized = sanitizePhone(rawData[mappings.phone]);
        const sanitizedPhone = sanitized ? canonicalizeBrazilPhone(sanitized) : null;
        const sanitizedName = sanitizeString(rawData[mappings.name]);

        if (!sanitizedName || !sanitizedPhone) {
            summary.errors++;
            continue;
        }

        if (processedPhonesInChunk.has(sanitizedPhone)) {
            summary.ignored++;
            continue;
        }
        
        const existingId = existingContactsMap.get(sanitizedPhone);
        
        const contactData = {
            companyId,
            name: sanitizedName,
            phone: sanitizedPhone,
            email: mappings.email ? sanitizeString(rawData[mappings.email]) : null,
            avatarUrl: mappings.avatarUrl ? sanitizeString(rawData[mappings.avatarUrl]) : null,
            notes: mappings.notes ? sanitizeString(rawData[mappings.notes], 1000) : null,
            addressStreet: mappings.addressStreet ? sanitizeString(rawData[mappings.addressStreet]) : null,
            addressNumber: mappings.addressNumber ? sanitizeString(rawData[mappings.addressNumber]) : null,
            addressComplement: mappings.addressComplement ? sanitizeString(rawData[mappings.addressComplement]) : null,
            addressDistrict: mappings.addressDistrict ? sanitizeString(rawData[mappings.addressDistrict]) : null,
            addressCity: mappings.addressCity ? sanitizeString(rawData[mappings.addressCity]) : null,
            addressState: mappings.addressState ? sanitizeString(rawData[mappings.addressState]) : null,
            addressZipCode: mappings.addressZipCode ? sanitizeString(rawData[mappings.addressZipCode]) : null,
            status: 'ACTIVE' as const,
            createdAt: new Date(),
          };

        if (existingId) {
            if (updateExisting) {
                // SECURITY: Validar tenant ao atualizar contato existente
                await db.update(contacts).set(contactData).where(and(
                    eq(contacts.id, existingId),
                    eq(contacts.companyId, companyId)
                ));
                updatedContactIds.push(existingId);
                allContactsToAssociate.push(existingId);
                summary.updated++;
            } else {
                summary.ignored++;
            }
        } else {
            newContactsToInsert.push(contactData);
        }

        processedPhonesInChunk.add(sanitizedPhone);
    }

    try {
        await db.transaction(async (tx) => {
            let codeLocation = "START";
            try {
                if (newContactsToInsert.length > 0) {
                    codeLocation = "INSERT_NEW_CONTACTS";
                    const newCreatedContacts = await tx.insert(contacts).values(newContactsToInsert).returning({ id: contacts.id });
                    allContactsToAssociate.push(...newCreatedContacts.map(c => c.id));
                    summary.created = newContactsToInsert.length;
                }

                if (updateExisting && updatedContactIds.length > 0) {
                    codeLocation = "DELETE_OLD_TAGS";
                    await tx.delete(contactsToTags).where(inArray(contactsToTags.contactId, updatedContactIds));
                    codeLocation = "DELETE_OLD_LISTS";
                    await tx.delete(contactsToContactLists).where(inArray(contactsToContactLists.contactId, updatedContactIds));
                }
                
                if (allContactsToAssociate.length > 0) {
                    if (tagIds.length > 0) {
                        codeLocation = "INSERT_NEW_TAGS";
                        const tagsData = allContactsToAssociate.flatMap(contactId => tagIds.map(tagId => ({ contactId, tagId })));
                        await tx.insert(contactsToTags).values(tagsData);
                    }
                    if (listIds.length > 0) {
                        codeLocation = "INSERT_NEW_LISTS";
                        const listsData = allContactsToAssociate.flatMap(contactId => listIds.map(listId => ({ contactId, listId })));
                        await tx.insert(contactsToContactLists).values(listsData);
                    }
                }
            } catch (error: any) {
                 throw {
                    message: `Erro na transação: ${error.message}`,
                    codeLocation, 
                    originalError: error
                };
            }
        });

    } catch (txErr: any) {
        if (process.env.NODE_ENV !== 'production') console.debug('Erro detalhado na transação de importação:', txErr);
        const errorDetails = txErr.originalError ? txErr.originalError.message : txErr.message;
        return NextResponse.json({
            success: false,
            summary,
            error: 'Erro durante a transação no banco de dados.',
            details: errorDetails,
            codeLocation: txErr.codeLocation || 'UNKNOWN',
        }, { status: 500 });
    }


    return NextResponse.json({
      success: true,
      summary,
    });
  } catch (error: any) {
    if (process.env.NODE_ENV !== 'production') console.debug('Erro geral no endpoint de importação:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor.';
    return NextResponse.json({ error: errorMessage, details: (error as Error).stack }, { status: 500 });
  }
}
