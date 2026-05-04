// scripts/check-gemini-quota-notifications.ts
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  console.log('=== 🔔 VERIFICAÇÃO: Notificações de Quota Gemini ===\n');

  // Buscar notificações sobre quota Gemini esgotada
  const notificationsRaw = await db.execute(sql`
    SELECT 
      id,
      user_id as "userId",
      company_id as "companyId",
      type,
      title,
      message,
      read_at as "readAt",
      created_at as "createdAt"
    FROM user_notifications
    WHERE message LIKE '%Gemini%' OR message LIKE '%quota%' OR title LIKE '%Gemini%'
    ORDER BY created_at DESC
    LIMIT 20
  `);

  const notifications = (Array.isArray(notificationsRaw)
    ? notificationsRaw
    : notificationsRaw.rows || []) as Array<{
      id: string;
      userId: string;
      companyId: string;
      type: string;
      title: string;
      message: string;
      readAt: Date | null;
      createdAt: Date;
    }>;

  console.log(`📬 NOTIFICAÇÕES ENCONTRADAS: ${notifications.length}\n`);

  if (notifications.length === 0) {
    console.log('⚠️ Nenhuma notificação sobre quota Gemini encontrada');
    console.log('   Isso pode indicar que:');
    console.log('   1. As notificações não foram criadas');
    console.log('   2. As notificações foram deletadas');
    console.log('   3. O sistema de notificações não está funcionando\n');
  } else {
    notifications.forEach((notif, idx) => {
      console.log(`\n[${idx + 1}] ID: ${notif.id}`);
      console.log(`    Tipo: ${notif.type}`);
      console.log(`    Título: ${notif.title}`);
      console.log(`    Mensagem: ${notif.message}`);
      console.log(`    Lida: ${notif.readAt ? 'Sim' : 'Não'}`);
      console.log(`    Criada em: ${notif.createdAt}`);
    });
  }

  console.log(`\n\n${'='.repeat(80)}`);
  console.log('🔑 VERIFICAÇÃO DE CREDENCIAIS:\n');

  const envNames = ['gemini_25_agent_google_chat', 'GOOGLE_API_KEY', 'openai_apikey_gpt_padrao', 'OPENAI_API_KEY'];
  const configured = envNames.map(name => ({ name: name.replace(/api.?key/gi, '***'), ok: !!process.env[name] }));
  const geminiOk = configured[0].ok || configured[1].ok;
  const openaiOk = configured[2].ok || configured[3].ok;

  console.log(`   Provedor Gemini: ${geminiOk ? '✅ Configurado' : '❌ NÃO CONFIGURADO'}`);
  console.log(`   Provedor OpenAI: ${openaiOk ? '✅ Configurado' : '❌ NÃO CONFIGURADO'}`);

  if (!geminiOk) {
    console.log('\n⚠️ ATENÇÃO: Credencial Gemini não configurada!');
    console.log('   Configure as credenciais do provedor Gemini nos Secrets.');
  }

  process.exit(0);
}

main().catch(console.error);
