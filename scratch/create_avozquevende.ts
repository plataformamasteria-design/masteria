import { db } from '../src/lib/db';
import { companies, users } from '../src/lib/db/schema';
import bcrypt from 'bcryptjs';

async function main() {
  try {
    console.log('Criando organizacao "A VOZ QUE VENDE"...');
    const [company] = await db.insert(companies).values({
      name: 'A VOZ QUE VENDE',
      lifetime: true,
    }).returning();
    
    console.log('Organizacao criada com sucesso. ID:', company.id);

    const hashedPassword = await bcrypt.hash('Grupo@Voz2025', 10);

    console.log('Criando usuario "leandro@avozquevende.com.br"...');
    const [user] = await db.insert(users).values({
      name: 'Leandro',
      email: 'leandro@avozquevende.com.br',
      password: hashedPassword,
      role: 'admin',
      companyId: company.id,
      emailVerified: new Date(),
    }).returning();

    console.log('Usuario criado com sucesso. ID:', user.id);
    console.log('✅ Operacao concluida!');
    process.exit(0);
  } catch (err) {
    console.error('Erro ao criar conta:', err);
    process.exit(1);
  }
}

main();
