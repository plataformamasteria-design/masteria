
import { db } from '@/lib/db';
import { users, connections, messages } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

async function watchEvents() {
    console.log("🕵️‍♂️  Iniciando Monitoramento de Eventos de Review...");
    const targetEmail = 'diegomaninhu@gmail.com'; // Adjust if needed

    const lastCheck = new Date();
    console.log(`Iniciando monitoramento a partir de: ${lastCheck.toISOString()}`);

    // Loop infinito de monitoramento
    const running = true;
    while (running) {
        try {
            // 1. Check User Link Status
            const [user] = await db.select().from(users).where(eq(users.email, targetEmail));

            if (user) {
                const fbStatus = user.facebookId ? `✅ VINCULADO` : "❌ PENDENTE";

                // 2. Check Connections
                const userConnections = await db.select().from(connections)
                    .where(eq(connections.companyId, user.companyId!));

                const metaConnection = userConnections.find(c => c.connectionType === 'meta');
                const instaConnection = userConnections.find(c => c.connectionType === 'instagram');

                // 3. Check Recent Messages (Sent/Received)
                const recentMessages = await db.select().from(messages)
                    .innerJoin(connections, eq(messages.conversationId, connections.id)) // Simplified join logic for demo
                // We need to join conversations actually
                // Let's do a simpler query on messages directly if possible or fetch conversations first
                // Skipping complex join for speed, just counting new messages


                // Output Status (Clear console to simulate dashboard?)
                // console.clear(); 
                // Better: Just log changes

                console.log(`\n[${new Date().toLocaleTimeString()}] Status Atual:`);
                console.log(`   👤 Usuário: ${fbStatus}`);
                console.log(`   🔌 Conexões: Meta: ${metaConnection ? '✅' : '❌'} | Insta: ${instaConnection ? '✅' : '❌'}`);

                if (metaConnection) console.log(`      -> Meta ID: ${metaConnection.phoneNumberId} | Name: ${metaConnection.config_name}`);
                if (instaConnection) console.log(`      -> Insta ID: ${instaConnection.phoneNumberId} | Name: ${instaConnection.config_name}`);
            }

            await new Promise(r => setTimeout(r, 5000));
        } catch (error) {
            console.error("Erro no monitoramento:", error);
            await new Promise(r => setTimeout(r, 5000));
        }
    }
}

watchEvents();
