const url = "https://masteria.app/api/internal/migrate-baileys-auth";
const options = {
    headers: {
        "Authorization": "Bearer baileys-migration-secret-2024"
    }
};

async function poll() {
    console.log("Iniciando varredura da API...");
    for (let i = 0; i < 15; i++) {
        try {
            const res = await fetch(url, options);
            if (res.ok) {
                const data = await res.json();
                if (data.debugFileSystem) { // Nova assinatura
                    console.log("Sucesso! Deploy Ativo!");
                    console.log(JSON.stringify(data, null, 2));
                    break;
                } else {
                    console.log(`Recebido 200 OK, mas sem a nova assinatura. Versão antiga ainda rodando... (${i}/15)`);
                }
            } else {
                console.log(`Aguardando substituição de versão (Status: ${res.status})... (${i}/15)`);
            }
        } catch (e) {
            console.log(`Erro de fetch: ${e.message} (${i}/15)`);
        }
        await new Promise(r => setTimeout(r, 20000));
    }
    console.log("Finalizado.");
}

poll();
