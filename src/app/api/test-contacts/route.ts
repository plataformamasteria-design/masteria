import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { contacts, companies, aiChats, users } from '@/lib/db/schema';
import { isNull, sql } from 'drizzle-orm';


// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Teste básico de conexão
    await db.execute(sql`SELECT 1 as test`);
    
    // Contar total de contatos
    const totalContactsResult = await db
      .select({ count: sql<number>`cast(count(${contacts.id}) as int)` })
      .from(contacts)
      .where(isNull(contacts.deletedAt));
    
    const totalContacts = totalContactsResult[0]?.count || 0;
    

    
    // Verificar empresas
    const companiesResult = await db
      .select({ count: sql<number>`cast(count(${companies.id}) as int)` })
      .from(companies);
    
    const companiesCount = companiesResult[0]?.count || 0;
    
    // Verificar chats de IA existentes
    const aiChatsResult = await db
      .select({ count: sql<number>`cast(count(${aiChats.id}) as int)` })
      .from(aiChats);
    
    const aiChatsCount = aiChatsResult[0]?.count || 0;
    
    // Verificar usuários
    const usersResult = await db
      .select({ count: sql<number>`cast(count(${users.id}) as int)` })
      .from(users);
    
    const usersCount = usersResult[0]?.count || 0;
    
    return NextResponse.json({
      success: true,
      stats: {
        contacts: totalContacts,
        companies: companiesCount,
        aiChats: aiChatsCount,
        users: usersCount
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    return NextResponse.json(
      { 
        success: false, 
        error: 'Database connection test failed',
        timestamp: new Date().toISOString()
      }, 
      { status: 500 }
    );
  }
}