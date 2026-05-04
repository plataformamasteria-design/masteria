import { fetchInitialConversations } from './src/app/actions/chat';

async function test() {
    console.log("Fetching...");
    try {
        const res = await fetchInitialConversations();
        console.log("Success! Fetched", res.length, "conversations");
        console.log(JSON.stringify(res[0], null, 2));
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}

test();
