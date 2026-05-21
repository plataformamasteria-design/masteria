import { db } from "./src/lib/db";
import { users, teams, usersToTeams } from "./src/lib/db/schema";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const COMPANY_ID = "7cb4773e-1fab-4699-b35d-c70d9f8d9149";

const usersToCreate = [
  { name: "Rafaela Alves Nogueira", email: "antoniojr@soleenergia.com.br", department: "Seção de vendas" },
  { name: "Deivid", email: "Deivid.desenvolvedorweb@gmail.com", department: "Seção de vendas" },
  { name: "Murilo Camargo", email: "murilo.camargo@nagatecnologia.com.br", department: "Seção de vendas" },
  { name: "Usuário Teste", email: "heitorsantos@www.hlmidias.com", department: "Seção de vendas" },
  { name: "Lucas Leme", email: "lucasleme.af@gmail.com", department: "Seção de vendas" },
  { name: "Jorge Junior", email: "mindxgestaocomercial@gmail.com", department: "Seção de vendas" },
  { name: "Guilherme Macedo", email: "guilhermemacedo.af@gmail.com", department: "Seção de vendas" },
  { name: "Bruno Macedo", email: "brunomacedolopes.af@gmail.com", department: "Seção de vendas" },
  { name: "Andrea Adegas", email: "andrea.plataformaglobalaf@gmail.com", department: "Seção de vendas" },
  { name: "Murillo Sano", email: "Murillosano.af@gmail.com", department: "Seção de vendas" },
  { name: "Anderson Menezes", email: "andersonmenezes.af@gmail.com", department: "Seção de vendas" },
  { name: "Camila Brandao", email: "Camilabrandao.af@gmail.com", department: "Seção de vendas" }
];

async function run() {
  console.log("Iniciando cadastro no banco de dados...");
  
  // 1. Get or Create Team
  const teamName = "Seção de vendas";
  let teamId = "";

  const existingTeam = await db.query.teams.findFirst({
    where: and(eq(teams.companyId, COMPANY_ID), eq(teams.name, teamName))
  });

  if (existingTeam) {
    teamId = existingTeam.id;
    console.log(`Equipe encontrada: ${teamId}`);
  } else {
    teamId = crypto.randomUUID();
    await db.insert(teams).values({
      id: teamId,
      companyId: COMPANY_ID,
      name: teamName,
      description: "Grupo criado via automação",
      active: true
    });
    console.log(`Equipe criada: ${teamId}`);
  }

  // 2. Add Users
  const passwordHash = bcrypt.hashSync("12345678", 10);

  for (const u of usersToCreate) {
    console.log(`\nProcessando: ${u.email}`);
    let userId = "";

    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, u.email)
    });

    if (existingUser) {
      console.log("Usuário já existe. Atualizando empresa...");
      userId = existingUser.id;
      await db.update(users).set({ companyId: COMPANY_ID, name: u.name }).where(eq(users.id, userId));
    } else {
      console.log("Criando novo usuário...");
      userId = crypto.randomUUID();
      await db.insert(users).values({
        id: userId,
        name: u.name,
        email: u.email,
        password: passwordHash,
        role: "atendente",
        companyId: COMPANY_ID,
        emailVerified: new Date()
      });
    }

    // 3. Link to Team
    const existingLink = await db.query.usersToTeams.findFirst({
      where: and(eq(usersToTeams.userId, userId), eq(usersToTeams.teamId, teamId))
    });

    if (!existingLink) {
      console.log("Adicionando usuário à equipe...");
      await db.insert(usersToTeams).values({
        userId,
        teamId,
        companyId: COMPANY_ID
      });
    } else {
      console.log("Usuário já está na equipe.");
    }
  }

  console.log("\nProcesso concluído com sucesso!");
}

run().catch(console.error).finally(() => process.exit(0));
