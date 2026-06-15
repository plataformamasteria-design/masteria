async function main() {
    const token = 'EAAMNZBpcDzagBRuuUEiHjsAuZCYZB2lQS8DYhLFkcGH0TR5J6r51tMi9ZBWqVCAoHOzvT0BGxjK3ocjfro6k5CvGqTPVXCEr7ktxYybB9iU5f9YzhUxwwjh87emA1jefUKrSL2ye7ZCDzCwrPUWROczAe83oF02aNBK7LI6f0VwbumJx9ZC1agRIPvPml5XwZDZD';
    const appId = '859794856725928';
    const appSecret = '9b3960e54b92e4f3083dc1d071f98899';
    
    const url = `https://graph.facebook.com/debug_token?input_token=${token}&access_token=${appId}|${appSecret}`;
    const res = await fetch(url);
    const data = await res.json();
    console.log("Debug Token Response:", JSON.stringify(data, null, 2));
}

main().catch(console.error).finally(() => process.exit(0));
