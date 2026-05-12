import fs from 'fs';
const text = fs.readFileSync('scratch_active_flow_out.txt', 'utf16le');
console.log(text.substring(0, 4000));
