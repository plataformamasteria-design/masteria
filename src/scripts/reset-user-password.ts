// src/scripts/reset-user-password.ts
// Script to verify user and reset password
// Usage: npx tsx src/scripts/reset-user-password.ts <email> [newPassword]

import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { hash } from 'bcryptjs';

async function resetUserPassword(email?: string, newPassword?: string) {
    console.log('🔐 User Password Reset Script\n');

    if (!email) {
        console.log('Usage: npx tsx src/scripts/reset-user-password.ts <email> [newPassword]');
        console.log('Examples:');
        console.log('  npx tsx src/scripts/reset-user-password.ts user@example.com');
        console.log('  npx tsx src/scripts/reset-user-password.ts user@example.com NewPassword123!');
        return;
    }

    try {
        // Find user by email (case insensitive)
        const [user] = await db.select({
            id: users.id,
            email: users.email,
            name: users.name,
            role: users.role,
            companyId: users.companyId,
            emailVerified: users.emailVerified,
            createdAt: users.createdAt,
        })
            .from(users)
            .where(eq(users.email, email.toLowerCase()));

        if (!user) {
            console.log(`❌ Usuário não encontrado: ${email}`);
            console.log('\nUsuários existentes:');

            const allUsers = await db.select({
                email: users.email,
                name: users.name,
            }).from(users).limit(10);

            allUsers.forEach(u => console.log(`  - ${u.email} (${u.name || 'sem nome'})`));
            return;
        }

        console.log('✅ Usuário encontrado:');
        console.log(`   ID: ${user.id}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Nome: ${user.name || 'N/A'}`);
        console.log(`   Role: ${user.role}`);
        console.log(`   Email Verificado: ${user.emailVerified ? 'Sim' : 'Não'}`);
        console.log(`   Company ID: ${user.companyId}`);
        console.log(`   Criado em: ${user.createdAt}`);

        if (newPassword) {
            console.log('\n🔄 Alterando senha...');

            // Hash the new password
            const hashedPassword = await hash(newPassword, 12);

            // Update password only
            await db.update(users)
                .set({ password: hashedPassword })
                .where(eq(users.id, user.id));

            console.log('✅ Senha alterada com sucesso!');
        } else {
            console.log('\n💡 Para resetar a senha, execute:');
            console.log(`   npx tsx src/scripts/reset-user-password.ts ${email} NovaSenha123!`);
        }

    } catch (error) {
        console.error('❌ Erro:', error);
        process.exit(1);
    }
}

// Get args from command line
const email = process.argv[2];
const newPassword = process.argv[3];

resetUserPassword(email, newPassword).then(() => {
    console.log('\n✅ Done');
    process.exit(0);
}).catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});
