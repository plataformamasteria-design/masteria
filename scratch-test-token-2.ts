async function main() {
    const token = 'EAAMNZBpcDzagBRuuUEiHjsAuZCYZB2lQS8DYhLFkcGH0TR5J6r51tMi9ZBWqVCAoHOzvT0BGxjK3ocjfro6k5CvGqTPVXCEr7ktxYybB9iU5f9YzhUxwwjh87emA1jefUKrSL2ye7ZCDzCwrPUWROczAe83oF02aNBK7LI6f0VwbumJx9ZC1agRIPvPml5XwZDZD';
    const phoneNumberId = '1098490746688494';
    
    const url2 = `https://graph.facebook.com/v21.0/${phoneNumberId}?access_token=${token}`;
    const res2 = await fetch(url2);
    const data2 = await res2.json();
    console.log("Phone Number Response:", JSON.stringify(data2, null, 2));
}

main().catch(console.error).finally(() => process.exit(0));
