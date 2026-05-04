
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const target = process.argv[2];
if (!target) {
    console.error('No target directory specified');
    process.exit(1);
}

const dirPath = path.resolve(process.cwd(), target);

if (fs.existsSync(dirPath)) {
    console.log(`🧹 Cleaning ${target} (preserving webpack cache)...`);
    try {
        // Preservar cache/webpack para dev mais rápido entre restarts
        const entries = fs.readdirSync(dirPath);
        let cleaned = 0;
        for (const entry of entries) {
            if (entry === 'webpack') {
                console.log(`  ⚡ Preserving ${target}/webpack cache`);
                continue;
            }
            fs.rmSync(path.join(dirPath, entry), { recursive: true, force: true });
            cleaned++;
        }
        console.log(`✅ ${target} cleaned (${cleaned} items removed, webpack cache preserved).`);
    } catch (err) {
        console.warn(`⚠️ Failed to clean ${target}: ${err.message}`);
    }
} else {
    console.log(`⏭️ ${target} does not exist, skipping.`);
}
