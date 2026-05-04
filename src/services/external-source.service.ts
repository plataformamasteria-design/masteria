// src/services/external-source.service.ts
import { db } from '@/lib/db';
import { personaExternalSources, personaPromptSections } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { parsePromptIntoSections } from '@/lib/rag/prompt-parser';

// Types
export type SourceType = 'google_sheets' | 'pdf' | 'csv' | 'website';
export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'error';

export interface ExternalSource {
    id: string;
    personaId: string;
    companyId: string;
    name: string;
    sourceType: SourceType;
    sourceUrl: string | null;
    s3Key: string | null;
    originalFileName: string | null;
    extractedContent: string | null;
    syncStatus: SyncStatus;
    syncError: string | null;
    lastSyncedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface CreateSourceInput {
    personaId: string;
    companyId: string;
    name: string;
    sourceType: SourceType;
    sourceUrl?: string;
    s3Key?: string;
    originalFileName?: string;
}

/**
 * External Source Service
 * Manages external data sources for AI persona RAG system
 * Supports: Google Sheets, PDF, CSV, and Website scraping
 */
export class ExternalSourceService {

    // ============================
    // CRUD Operations
    // ============================

    /**
     * Create a new external source
     */
    static async create(input: CreateSourceInput): Promise<ExternalSource> {
        const [source] = await db.insert(personaExternalSources).values({
            personaId: input.personaId,
            companyId: input.companyId,
            name: input.name,
            sourceType: input.sourceType,
            sourceUrl: input.sourceUrl || null,
            s3Key: input.s3Key || null,
            originalFileName: input.originalFileName || null,
            syncStatus: 'pending',
        }).returning();

        return source as ExternalSource;
    }

    /**
     * List all sources for a persona
     */
    static async listByPersona(personaId: string): Promise<ExternalSource[]> {
        const sources = await db.select()
            .from(personaExternalSources)
            .where(eq(personaExternalSources.personaId, personaId))
            .orderBy(personaExternalSources.createdAt);

        return sources as ExternalSource[];
    }

    /**
     * Get single source by ID
     */
    static async getById(sourceId: string): Promise<ExternalSource | null> {
        const [source] = await db.select()
            .from(personaExternalSources)
            .where(eq(personaExternalSources.id, sourceId));

        return source as ExternalSource | null;
    }

    /**
     * Delete a source and its associated RAG sections
     */
    static async delete(sourceId: string): Promise<boolean> {
        // First delete associated RAG sections
        await db.delete(personaPromptSections)
            .where(eq(personaPromptSections.externalSourceId, sourceId));

        // Then delete the source
        const result = await db.delete(personaExternalSources)
            .where(eq(personaExternalSources.id, sourceId));

        return true;
    }

    // ============================
    // Content Extraction Methods
    // ============================

    /**
     * Extract text from PDF buffer
     */
    static async processPDF(buffer: Buffer): Promise<string> {
        try {
            console.log(`[processPDF] Starting extraction. Buffer size: ${buffer.length} bytes`);

            // Dynamic import to avoid loading in browser context
            const pdfParse = await import('pdf-parse');
            const data = await pdfParse.default(buffer);

            // Clean up extracted text
            const cleanText = data.text
                .replace(/\s+/g, ' ')
                .replace(/\n{3,}/g, '\n\n')
                .trim();

            console.log(`[ExternalSource] Extracted ${cleanText.length} characters from PDF`);
            return cleanText;
        } catch (error) {
            console.error('[ExternalSource] PDF extraction error:', error);
            throw new Error(`Falha ao processar PDF: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
        }
    }

    /**
     * Parse CSV and convert to readable text format
     */
    static async processCSV(buffer: Buffer): Promise<string> {
        try {
            const Papa = await import('papaparse');
            const csvString = buffer.toString('utf-8');

            const result = Papa.parse(csvString, {
                header: true,
                skipEmptyLines: true,
            });

            if (result.errors.length > 0) {
                console.warn('[ExternalSource] CSV parse warnings:', result.errors);
            }

            // Convert parsed data to readable text
            const rows = result.data as Record<string, string>[];
            const headers = result.meta.fields || [];

            let textContent = `Dados da planilha (${rows.length} registros):\n\n`;

            // Add headers summary
            textContent += `Colunas: ${headers.join(', ')}\n\n`;

            // Add each row as structured text
            rows.forEach((row, index) => {
                textContent += `Registro ${index + 1}:\n`;
                headers.forEach(header => {
                    if (row[header]) {
                        textContent += `  - ${header}: ${row[header]}\n`;
                    }
                });
                textContent += '\n';
            });

            console.log(`[ExternalSource] Parsed ${rows.length} CSV rows`);
            return textContent.trim();
        } catch (error) {
            console.error('[ExternalSource] CSV parse error:', error);
            throw new Error(`Falha ao processar CSV: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
        }
    }

    /**
     * Fetch and scrape website content
     */
    static async processWebsite(url: string): Promise<string> {
        try {
            // Validate URL
            const urlObj = new URL(url);

            // ✅ SPECIAL HANDLING: Google Docs
            // Convert /edit or /view URLs to /export?format=txt to get raw text without UI
            if (urlObj.hostname.includes('docs.google.com') && urlObj.pathname.includes('/document/d/')) {
                console.log(`[ExternalSource] Detected Google Docs URL: ${url}`);

                const match = url.match(/\/document\/d\/([a-zA-Z0-9-_]+)/);
                if (match && match[1]) {
                    const docId = match[1];
                    const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=txt`;

                    console.log(`[ExternalSource] Fetching raw text from: ${exportUrl}`);
                    const response = await fetch(exportUrl, {
                        signal: AbortSignal.timeout(30000),
                    });

                    if (!response.ok) {
                        if (response.status === 404 || response.status === 401 || response.status === 403) {
                            throw new Error('Google Doc inacessível. Certifique-se que o documento está público ("Qualquer pessoa com o link").');
                        }
                        throw new Error(`Erro ao exportar Google Doc: HTTP ${response.status}`);
                    }

                    const text = await response.text();

                    // Basic cleanup of exported text
                    const cleanText = text
                        .replace(/\r\n/g, '\n')
                        .replace(/[ \t]+/g, ' ')
                        .replace(/\n{3,}/g, '\n\n')
                        .trim();

                    console.log(`[ExternalSource] Extracted ${cleanText.length} characters from Google Doc`);
                    return `Fonte: Google Docs (${url})\n\n${cleanText}`;
                }
            }


            // ✅ SPECIAL HANDLING: Google Sheets Published (pubhtml)
            // Convert /pubhtml to /pub?output=csv to get clean data
            if (urlObj.hostname.includes('docs.google.com') && (urlObj.pathname.includes('/pubhtml') || urlObj.pathname.includes('/pub'))) {
                console.log(`[ExternalSource] Detected Google Sheets Published URL: ${url}`);

                // Force CSV export format
                let csvUrl = url;
                if (url.includes('/pubhtml')) {
                    csvUrl = url.replace('/pubhtml', '/pub?output=csv');
                } else if (!url.includes('output=csv')) {
                    // It's likely just /pub, append query param
                    csvUrl = `${url}?output=csv`;
                    if (url.includes('?')) csvUrl = url.replace('?', '?output=csv&');
                }

                console.log(`[ExternalSource] Fetching published sheet as CSV: ${csvUrl}`);
                const response = await fetch(csvUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (compatible; MasterIA-Bot/1.0)',
                    },
                    signal: AbortSignal.timeout(30000),
                });

                if (!response.ok) {
                    throw new Error(`Erro ao exportar planilha publicada: HTTP ${response.status}`);
                }

                const csvText = await response.text();
                const buffer = Buffer.from(csvText, 'utf-8');

                // Reuse CSV processor
                const processed = await this.processCSV(buffer);
                return `Fonte: Google Sheets Publicado (${url})\n\n${processed}`;
            }

            // Standard Web Scraping (Cheerio)
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'MasterIA-Bot/1.0 (Knowledge Extraction)',
                    'Accept': 'text/html,application/xhtml+xml',
                },
                signal: AbortSignal.timeout(30000), // 30 second timeout
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const html = await response.text();

            // Use cheerio for HTML parsing
            const cheerio = await import('cheerio');
            const $ = cheerio.load(html);

            // Remove unwanted elements
            $('script, style, nav, footer, header, aside, iframe, noscript').remove();

            // Extract main content
            const title = $('title').text().trim();
            const mainContent = $('main, article, .content, #content, .post, .entry').first();

            let bodyText: string;
            if (mainContent.length > 0) {
                bodyText = mainContent.text();
            } else {
                bodyText = $('body').text();
            }

            // Clean up text
            const cleanText = bodyText
                .replace(/\s+/g, ' ')
                .replace(/\n{3,}/g, '\n\n')
                .trim();

            const result = title
                ? `Título: ${title}\n\nConteúdo:\n${cleanText}`
                : cleanText;

            console.log(`[ExternalSource] Scraped ${result.length} characters from ${url}`);
            return result;
        } catch (error) {
            console.error('[ExternalSource] Website scrape error:', error);
            throw new Error(`Falha ao extrair conteúdo do site: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
        }
    }

    /**
     * Fetch Google Sheets data (public sheets only)
     */
    static async processGoogleSheets(sheetUrl: string): Promise<string> {
        try {
            // Extract spreadsheet ID from URL
            const match = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
            if (!match) {
                throw new Error('URL inválida do Google Sheets. Use o formato: https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/...');
            }

            const spreadsheetId = match[1];

            // Use the public CSV export URL
            // Format: https://docs.google.com/spreadsheets/d/{id}/export?format=csv
            const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv`;

            const response = await fetch(csvUrl, {
                headers: {
                    'Accept': 'text/csv',
                },
                signal: AbortSignal.timeout(30000),
            });

            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('Planilha não encontrada. Verifique se a URL está correta.');
                }
                if (response.status === 403) {
                    throw new Error('Planilha privada. Configure a planilha como "Qualquer pessoa com o link pode visualizar".');
                }
                throw new Error(`Erro ao acessar planilha: HTTP ${response.status}`);
            }

            const csvText = await response.text();
            const buffer = Buffer.from(csvText, 'utf-8');

            // Reuse CSV processor
            return this.processCSV(buffer);
        } catch (error) {
            console.error('[ExternalSource] Google Sheets error:', error);
            throw new Error(`Falha ao processar Google Sheets: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
        }
    }

    // ============================
    // Sync Operations
    // ============================

    /**
     * Main sync method - extracts content and creates RAG sections
     */
    static async syncSource(sourceId: string): Promise<void> {
        const source = await this.getById(sourceId);
        if (!source) {
            throw new Error('Fonte não encontrada');
        }

        // Update status to syncing
        await db.update(personaExternalSources)
            .set({ syncStatus: 'syncing', syncError: null })
            .where(eq(personaExternalSources.id, sourceId));

        try {
            let extractedContent: string;

            // Extract content based on source type
            switch (source.sourceType) {
                case 'pdf':
                    if (!source.s3Key) throw new Error('Arquivo PDF não encontrado');
                    const pdfBuffer = await this.downloadFromS3(source.s3Key, source.companyId);
                    extractedContent = await this.processPDF(pdfBuffer);
                    break;

                case 'csv':
                    if (!source.s3Key) throw new Error('Arquivo CSV não encontrado');
                    const csvBuffer = await this.downloadFromS3(source.s3Key, source.companyId);
                    extractedContent = await this.processCSV(csvBuffer);
                    break;

                case 'website':
                    if (!source.sourceUrl) throw new Error('URL do site não fornecida');
                    extractedContent = await this.processWebsite(source.sourceUrl);
                    break;

                case 'google_sheets':
                    if (!source.sourceUrl) throw new Error('URL do Google Sheets não fornecida');
                    extractedContent = await this.processGoogleSheets(source.sourceUrl);
                    break;

                default:
                    throw new Error(`Tipo de fonte não suportado: ${source.sourceType}`);
            }

            // Delete old RAG sections from this source
            await db.delete(personaPromptSections)
                .where(eq(personaPromptSections.externalSourceId, sourceId));

            // Parse content into RAG sections
            const sections = await parsePromptIntoSections(extractedContent, {
                useAI: true,
                defaultLanguage: 'pt',
                minSections: 1,
                maxSections: 20,
            }, `source_${sourceId}`);

            // Create new RAG sections
            for (const section of sections) {
                await db.insert(personaPromptSections).values({
                    personaId: source.personaId,
                    sectionName: `${source.name} - ${section.sectionName}`,
                    content: section.content,
                    language: section.language,
                    priority: section.priority,
                    tags: [...(section.tags || []), 'external_source', source.sourceType],
                    isActive: true,
                    externalSourceId: sourceId,
                });
            }

            // Update source with success
            await db.update(personaExternalSources)
                .set({
                    syncStatus: 'synced',
                    extractedContent: extractedContent.substring(0, 50000), // Limit cached content
                    lastSyncedAt: new Date(),
                    syncError: null,
                })
                .where(eq(personaExternalSources.id, sourceId));

            console.log(`[ExternalSource] ✅ Synced source ${sourceId}: ${sections.length} sections created`);

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';

            // Update source with error
            await db.update(personaExternalSources)
                .set({
                    syncStatus: 'error',
                    syncError: errorMessage,
                })
                .where(eq(personaExternalSources.id, sourceId));

            console.error(`[ExternalSource] ❌ Sync failed for ${sourceId}:`, error);
            throw error;
        }
    }

    /**
     * Download file from S3/storage
     */
    private static async downloadFromS3(s3Key: string, companyId: string): Promise<Buffer> {
        console.log(`[downloadFromS3] Downloading key: ${s3Key} for company: ${companyId}`);
        const { getFileStream } = await import('@/lib/s3');
        const stream = await getFileStream(companyId, s3Key);

        // Convert stream to buffer
        const chunks: Buffer[] = [];
        for await (const chunk of stream as AsyncIterable<Buffer>) {
            chunks.push(chunk);
        }

        const buffer = Buffer.concat(chunks);
        console.log(`[downloadFromS3] Download complete. Size: ${buffer.length} bytes`);
        return buffer;
    }
}
