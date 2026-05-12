import { db } from './src/lib/db';
import { messageTemplates } from './src/lib/db/schema';
import { eq } from 'drizzle-orm';

function extractBodyText(template: any): string {
    if (template.body && typeof template.body === 'string') {
        return template.body;
    }
    if (template.components && Array.isArray(template.components)) {
        const bodyComponent = template.components.find((c: any) => c.type === 'BODY');
        if (bodyComponent?.text) {
            return bodyComponent.text;
        }
    }
    return '';
}

function extractHeaderType(template: any): string | null {
    if (template.headerType) {
        return template.headerType;
    }
    if (template.components && Array.isArray(template.components)) {
        const headerComponent = template.components.find((c: any) => c.type === 'HEADER');
        if (headerComponent?.format) {
            return headerComponent.format;
        }
    }
    return null;
}

async function run() {
  const t = await db.query.messageTemplates.findFirst({
    where: eq(messageTemplates.name, 'lista2edn7')
  });

  const bodyText = extractBodyText(t);
  const headerType = extractHeaderType(t);
  const hasMedia = headerType ? ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerType.toUpperCase()) : false;

  let mediaLink = null;
  let mediaAssetId = null;
  if (t?.components && Array.isArray(t.components)) {
      const headerComponent = t.components.find((c: any) => c.type === 'HEADER');
      if (headerComponent?.example) {
           mediaAssetId = headerComponent.example.mediaAssetId;
           const handle = headerComponent.example.header_handle?.[0];
           const url = headerComponent.example.header_url?.[0];
           const resolvedUrl = url || (handle?.startsWith('http') ? handle : null);
           mediaLink = headerComponent.example.mediaUrl || resolvedUrl;
      }
  }

  console.log({ mediaAssetId, mediaLink, needsUpload: (!mediaAssetId && mediaLink && mediaLink.includes('whatsapp.net')) });
  process.exit(0);
}
run();
