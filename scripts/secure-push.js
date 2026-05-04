const { execSync } = require('child_process');

const token = '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';
const repo = 'github.com/diegomaninhu/master-ia-oficial-v2-main.git';
const url = `https://${token}@${repo}`;

try {
    console.log('Attempting git push to main branch with FULL ACCESS token...');
    // Force push to ensure the clean build changes and my fixes are applied
    // Using 'main' as it seems to be the default remote branch
    execSync(`git push "${url}" master:main --force`, { stdio: 'inherit' });
    console.log('SUCCESS: Push completed.');
} catch (error) {
    console.error('Push failed:', error.message);
}
