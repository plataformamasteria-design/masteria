import fs from 'fs';
const data = JSON.parse(fs.readFileSync('tmp_logs.json', 'utf8'));
const logs = data.logs || [];
for (const log of logs.slice(0, 10)) {
    console.log(`[${log.created_at}] ${log.status}: ${log.message.substring(0, 500)}`);
}
