const fs = require('fs');
const files = [
  'src/app/api/v1/integrations/google/connect/route.ts',
  'src/app/api/v1/integrations/google/callback/route.ts',
  'src/app/api/v1/integrations/google-drive/connect/route.ts',
  'src/app/api/v1/integrations/google-drive/callback/route.ts'
];
const newFn = `function getBaseUrl(request: NextRequest): string {
    let url = process.env.NEXT_PUBLIC_APP_URL || '';
    url = url.replace(/['"]/g, '').trim();
    if (!url) {
        const forwardedHost = request.headers.get('x-forwarded-host');
        const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';
        if (forwardedHost) {
            url = \`\${forwardedProto}://\${forwardedHost}\`;
        } else {
            const host = request.headers.get('host');
            if (host && !host.startsWith('0.0.0.0') && !host.startsWith('localhost')) {
                url = \`https://\${host}\`;
            } else {
                url = request.nextUrl.origin;
            }
        }
    }
    return url.replace(/\\/+$/, '');
}`;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/function getBaseUrl\(request: NextRequest\): string \{[\s\S]*?\n\}/, newFn);
  fs.writeFileSync(file, content);
  console.log('Updated ' + file);
}
