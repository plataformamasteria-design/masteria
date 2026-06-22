// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse');

export async function parseDocumentBuffer(buffer: Buffer, fileType: string): Promise<string> {
    const ext = fileType.toLowerCase();
    
    try {
        if (ext.includes('pdf')) {
            const data = await pdfParse(buffer);
            return data.text;
        } 
        else if (ext.includes('text/plain') || ext.includes('csv') || ext.includes('txt')) {
            return buffer.toString('utf-8');
        }
        else {
            console.warn(`[DocumentParser] Formato não suportado para extração de texto pura: ${fileType}. Usando vazio.`);
            return '';
        }
    } catch (err) {
        console.error('[DocumentParser] Erro ao extrair texto do documento:', err);
        return '';
    }
}
