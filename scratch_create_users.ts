import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

// Polyfill WebSocket for Node.js 20
if (!global.WebSocket) {
  global.WebSocket = require("ws");
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const COMPANY_ID = "f28e5adf-ce84-436b-94c5-cd3941f254b7";

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
  console.log("Iniciando cadastro de usuários...");
  
  // 1. Check or create Department
  let departmentId: string;
  const { data: deptData, error: deptError } = await supabaseAdmin
    .from("departments")
    .select("id")
    .eq("company_id", COMPANY_ID)
    .eq("name", "Seção de vendas")
    .single();

  if (deptError && deptError.code !== "PGRST116") { // Not found
    console.error("Erro ao buscar departamento:", deptError);
    return;
  }

  if (deptData) {
    departmentId = deptData.id;
    console.log("Departamento encontrado:", departmentId);
  } else {
    console.log("Criando departamento 'Seção de vendas'...");
    const { data: newDept, error: insertDeptError } = await supabaseAdmin
      .from("departments")
      .insert({ company_id: COMPANY_ID, name: "Seção de vendas" })
      .select("id")
      .single();
    
    if (insertDeptError || !newDept) {
      console.error("Erro ao criar departamento:", insertDeptError);
      return;
    }
    departmentId = newDept.id;
    console.log("Departamento criado:", departmentId);
  }

  // 2. Create users
  for (const u of usersToCreate) {
    console.log(`Processando usuário: ${u.email}...`);
    
    // a) Create in Auth
    let authUserId: string;
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: u.email,
      password: "12345678",
      email_confirm: true,
      user_metadata: { name: u.name }
    });

    if (authError) {
      if (authError.message.includes("already registered") || authError.message.includes("already exists")) {
        console.log(`Usuário auth já existe para ${u.email}. Buscando ID...`);
        const { data: users, error: findError } = await supabaseAdmin.auth.admin.listUsers();
        if (findError) {
          console.error("Erro listando users:", findError);
          continue;
        }
        const existing = users.users.find(x => x.email === u.email);
        if (!existing) {
          console.log("Não encontrado na listagem.");
          continue;
        }
        authUserId = existing.id;
      } else {
        console.error("Erro ao criar user auth:", authError);
        continue;
      }
    } else {
      authUserId = authUser.user.id;
      console.log(`Usuário auth criado: ${authUserId}`);
    }

    // b) Check if exists in public.users
    const { data: publicUser } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("id", authUserId)
      .single();

    if (!publicUser) {
      console.log(`Inserindo em public.users...`);
      await supabaseAdmin.from("users").insert({
        id: authUserId,
        email: u.email,
        name: u.name,
        role: "USER"
      });
    }

    // c) Associate with company
    const { data: compUser } = await supabaseAdmin
      .from("company_users")
      .select("*")
      .eq("user_id", authUserId)
      .eq("company_id", COMPANY_ID)
      .single();

    if (!compUser) {
      console.log(`Associando à empresa e departamento...`);
      const { error: compError } = await supabaseAdmin.from("company_users").insert({
        user_id: authUserId,
        company_id: COMPANY_ID,
        role: "USER",
        department_id: departmentId
      });
      if (compError) {
         console.error("Erro ao associar:", compError);
      }
    } else {
      console.log(`Atualizando departamento...`);
      await supabaseAdmin.from("company_users").update({ department_id: departmentId }).eq("id", compUser.id);
    }
    
    console.log(`OK: ${u.email}\n`);
  }
  
  console.log("Finalizado!");
}

run();
