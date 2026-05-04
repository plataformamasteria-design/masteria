
import 'dotenv/config';
import { db } from '@/lib/db';
import fs from 'fs';

async function main() {
    try {
        console.log('🔍 Buscando configurações de Webhook...');

        const company = await db.query.companies.findFirst();

        if (!company) {
            console.error('❌ Nenhuma empresa encontrada.');
            return;
        }

        const slug = company.webhookSlug;
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.REPLIT_DEV_DOMAIN || 'https://masteria-x-oficial.replit.app'; // Fallback guess

        // Ensure https
        const finalUrl = baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`;
        // Clean up double slashes if any (except protocol)
        const cleanUrl = finalUrl.replace(/([^:]\/)\/+/g, "$1");
        const webhookUrl = `${cleanUrl}/api/webhooks/meta/${slug}`;

        console.log(`\n📋 Configurações Encontradas:`);
        console.log(`Webhook URL: ${webhookUrl}`);

        fs.writeFileSync('webhook_url.txt', webhookUrl);
        console.log('URL written to webhook_url.txt');

    } catch (error) {
        console.error('Erro ao buscar configurações:', error);
    }
}

main();
