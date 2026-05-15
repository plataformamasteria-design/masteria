const fs = require('fs');
const path = require('path');

const apiDir = path.join(__dirname, '..', 'src', 'app', 'api');

function apiExists(endpoint) {
    if (!endpoint.startsWith('/api/')) return true; // not an internal api
    // Strip query params
    const route = endpoint.split('?')[0].replace('/api/', '');
    // Usually mapped to src/app/api/.../route.ts
    // or nextjs dynamic routes [id] -> we just check if any part exists
    // Let's do a simple check
    
    // Exact check first
    const exactPath = path.join(apiDir, route, 'route.ts');
    if (fs.existsSync(exactPath)) return true;
    
    // Maybe dynamic? like /api/meta/[accountId]
    const parts = route.split('/');
    let currentDir = apiDir;
    for (const part of parts) {
        if (!fs.existsSync(currentDir)) return false;
        
        let found = false;
        const items = fs.readdirSync(currentDir);
        for (const item of items) {
            if (item === part) {
                currentDir = path.join(currentDir, item);
                found = true;
                break;
            }
            if (item.startsWith('[') && item.endsWith(']')) {
                currentDir = path.join(currentDir, item);
                found = true;
                break;
            }
        }
        if (!found) return false;
    }
    
    return fs.existsSync(path.join(currentDir, 'route.ts')) || fs.existsSync(path.join(currentDir, 'route.js'));
}

const auditText = fs.readFileSync(path.join(__dirname, 'marketing_audit.txt'), 'utf16le');
const lines = auditText.split('\n');

const missingApis = new Set();

lines.forEach(line => {
    if (line.includes('[FETCH]')) {
        const urlMatch = line.match(/\[FETCH\] L\d+: (.+)/);
        if (urlMatch) {
            const url = urlMatch[1].trim();
            // Try to resolve template literals roughly
            let cleanUrl = url.replace(/\$\{.*?\}/g, 'dummy');
            if (cleanUrl.startsWith('/api/') && !apiExists(cleanUrl)) {
                missingApis.add(cleanUrl.split('?')[0]);
            }
        }
    }
});

console.log("Missing API Routes:");
missingApis.forEach(a => console.log(a));
