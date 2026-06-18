import { db } from '../src/lib/db/index';
import { companies, users } from '../src/lib/db/schema';
import bcrypt from 'bcryptjs';

async function main() {
  try {
    const email = 'contatestecrfpa@masteria.com';
    const password = 'crfpa1809@';
    const companyName = 'CRF-PA (Teste)';

    console.log(`Criando organização: ${companyName}...`);
    const [company] = await db.insert(companies).values({
      name: companyName,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    console.log(`Organização criada com ID: ${company.id}`);

    console.log(`Gerando hash para a senha...`);
    const hashedPassword = await bcrypt.hash(password, 10);

    console.log(`Criando usuário: ${email}...`);
    const [user] = await db.insert(users).values({
      name: 'Admin CRF-PA',
      email: email,
      password: hashedPassword,
      role: 'admin',
      companyId: company.id,
      createdAt: new Date(),
    }).returning();

    console.log(`Usuário criado com ID: ${user.id}`);
    console.log('Sucesso!');
    process.exit(0);
  } catch (error) {
    console.error('Erro ao criar conta:', error);
    process.exit(1);
  }
}

main();
