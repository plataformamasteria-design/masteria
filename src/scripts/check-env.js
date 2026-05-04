
const envVars = [
    'OPENROUTER_API_KEY',
    'openrouters_free_model_agents',
    'openrouter_apikey',
    'openrouter_api_key'
];

console.log('Checking environment variables:');
envVars.forEach(v => {
    const val = process.env[v];
    console.log(`${v}: ${val ? 'SET (length: ' + val.length + ')' : 'NOT SET'}`);
});
