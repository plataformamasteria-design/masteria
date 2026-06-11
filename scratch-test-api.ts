import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { NextRequest } from 'next/server';
import { GET } from './src/app/api/v1/conversations/[conversationId]/messages/route';
import { db } from './src/lib/db';
import { conversations, companies, users } from './src/lib/db/schema';
import { getUserIdFromSession, getCompanyIdFromSession } from './src/app/actions';

// Mock the auth
jest = require('jest-mock');
jest.mock('./src/lib/api-auth-helper', () => ({
    requireAuthWithUserOr401: async () => {
        const company = await db.query.companies.findFirst();
        const user = await db.query.users.findFirst({ where: (users, { eq }) => eq(users.companyId, company.id) });
        return { companyId: company.id, user: user };
    }
}));

async function main() {
    const conv = await db.query.conversations.findFirst();
    const req = new NextRequest(`http://localhost:3000/api/v1/conversations/${conv.id}/messages`);
    const params = { conversationId: conv.id };
    
    const response = await GET(req, { params });
    const text = await response.text();
    console.log('Response:', response.status, text);
}
main().then(()=>process.exit(0)).catch(console.error);
