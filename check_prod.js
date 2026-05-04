const https = require('https');

https.get('https://masteria.app/automacoes', (res) => {
    let html = '';
    res.on('data', d => html += d);
    res.on('end', () => {
        const chunkRegex = /static\/chunks\/([^\"]+\.js)/g;
        const uniqueChunks = [...new Set([...html.matchAll(chunkRegex)].map(m => m[1]))];

        console.log('Downloading ' + uniqueChunks.length + ' chunks to find the Editor bundle...');

        uniqueChunks.forEach(chunkName => {
            https.get('https://masteria.app/_next/static/chunks/' + chunkName, (res2) => {
                let js = '';
                res2.on('data', d => js += d);
                res2.on('end', () => {
                    if (js.includes('ExecutionHistoryPanel')) {
                        console.log('\n--- FOUND EDITOR CHUNK ---');
                        console.log('Chunk:', chunkName);
                        console.log('Contains Array.isArray(nds)?', js.includes('Array.isArray(nds)'));
                        console.log('Contains isArray in general?', js.includes('isArray'));
                        console.log('Contains updateNodeData?', js.includes('updateNodeData'));
                    }
                });
            });
        });
    });
}).on('error', console.error);
