

import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../lib/db/schema';
import 'dotenv/config';
import { randomUUID } from 'crypto';
import { hash } from 'bcryptjs';

const COMPANY_NAME = 'Empresa de Desenvolvimento Master';
const USER_EMAIL = 'paulo@exemplo.com';
const FIREBASE_UID = 'dev_firebase_uid_paulo';
const DEFAULT_PASSWORD = 'password';
const TEST_USER_EMAIL = 'diegomaninhu@gmail.com';
const TEST_FIREBASE_UID = 'dev_firebase_uid_diego';
const TEST_DEFAULT_PASSWORD = 'MasterIA2025!';

export async function runSeed(db: PostgresJsDatabase<typeof schema>): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    console.warn("Seed script is disabled in production environment.");
    return;
  }

  console.log('🟢  Iniciando seed Drizzle...');

  try {
    // Insere ou atualiza a empresa e garante que temos o ID dela de volta.
    const [company] = await db
      .insert(schema.companies)
      .values({
        name: COMPANY_NAME,
        webhookSlug: randomUUID(),
      })
      .onConflictDoUpdate({
        target: schema.companies.name,
        set: {
          name: COMPANY_NAME,
          updatedAt: new Date(),
        },
      })
      .returning();

    if (!company) {
      throw new Error("Falha ao criar ou encontrar a empresa de desenvolvimento.");
    }
    console.log(`   - Empresa "${company.name}" (ID: ${company.id}) criada/verificada.`);

    // Cria o hash da senha padrão
    const passwordHash = await hash(DEFAULT_PASSWORD, 10);
    const testPasswordHash = await hash(TEST_DEFAULT_PASSWORD, 10);

    // Upsert o utilizador de desenvolvimento
    const [user] = await db
      .insert(schema.users)
      .values({
        name: 'Paulo Super Admin',
        email: USER_EMAIL,
        password: passwordHash, // Salva a senha hasheada na criação
        firebaseUid: FIREBASE_UID,
        role: 'superadmin',
        companyId: company.id,
        emailVerified: new Date(),
      })
      .onConflictDoUpdate({
        target: schema.users.email,
        set: { 
            name: 'Paulo Super Admin', 
            role: 'superadmin',
            companyId: company.id,
            password: passwordHash,
            emailVerified: new Date()
        },
      })
      .returning();
    
    if (!user) {
      throw new Error("Falha ao criar ou encontrar o utilizador de desenvolvimento.");
    }

    console.log(`   - Utilizador "${user.name}" criado/verificado e associado à empresa.`);

    const [testUser] = await db
      .insert(schema.users)
      .values({
        name: 'Diego Test User',
        email: TEST_USER_EMAIL,
        password: testPasswordHash,
        firebaseUid: TEST_FIREBASE_UID,
        role: 'superadmin',
        companyId: company.id,
        emailVerified: new Date(),
      })
      .onConflictDoUpdate({
        target: schema.users.email,
        set: {
          name: 'Diego Test User',
          role: 'superadmin',
          companyId: company.id,
          password: testPasswordHash,
          emailVerified: new Date(),
        },
      })
      .returning();

    if (!testUser) {
      throw new Error("Falha ao criar ou encontrar o utilizador de teste.");
    }

    console.log(`   - Utilizador de teste "${testUser.name}" criado/verificado e associado à empresa.`);
    console.log('🔵 Seed Drizzle concluído com sucesso!');
  } catch (err) {
    console.error('❌ Erro no seed:', err);
    throw err;
  }
}
