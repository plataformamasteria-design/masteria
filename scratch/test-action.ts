import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import { updateAiNodeConfig } from '../src/app/actions/automations-builder';
import * as authHelper from '../src/lib/api-auth-helper';

async function main() {
    // Mock the auth helper
    (authHelper as any).requireAuthOr401 = async () => {
        return { companyId: 'f28e5adf-ce84-436b-94c5-cd3941f254b7', userId: 'user1' };
    };

    try {
        await updateAiNodeConfig('41bc227d-cb09-485a-8bde-715bd0dc0eb7', 'fake_node', 'new prompt', 'new notes');
        console.log("Success");
    } catch (e: any) {
        console.error("Error intercepted:", e.message);
        console.error(e.stack);
    }
}

main();
