#!/bin/bash
set -e # Exit immediately if a command exits with a non-zero status.

echo "### Firebase Secrets Setup Script ###"
echo "Este script irá ler o seu ficheiro .env e criar os secrets correspondentes no Google Cloud Secret Manager."

# 1. Check for dependencies
if ! command -v gcloud &> /dev/null; then
    echo "Erro: 'gcloud' CLI não encontrado. Por favor, instale e configure o Google Cloud SDK."
    exit 1
fi
if ! command -v jq &> /dev/null; then
    echo "Erro: 'jq' não encontrado. Por favor, instale jq (ex: sudo apt-get install jq)."
    exit 1
fi

if [ ! -f .env ]; then
    echo "Erro: Ficheiro .env não encontrado na raiz do projeto."
    exit 1
fi

# 2. Get Project ID (Improved Logic)
get_project_id() {
    if [[ -f .firebaserc ]]; then
        PROJECT_ID_FROM_FILE=$(jq -r '.projects.default' .firebaserc 2>/dev/null)
        if [[ -n "$PROJECT_ID_FROM_FILE" && "$PROJECT_ID_FROM_FILE" != "null" ]]; then
            echo "$PROJECT_ID_FROM_FILE"
            return
        fi
    fi
    # Fallback to gcloud config if .firebaserc is not helpful
    gcloud config get-value project 2>/dev/null || echo ""
}

PROJECT_ID=$(get_project_id)
if [ -z "$PROJECT_ID" ]; then
    read -p "Não foi possível detetar o ID do Projeto. Por favor, insira o ID do seu projeto Firebase (ex: zap-master-mvp): " PROJECT_ID
    if [ -z "$PROJECT_ID" ]; then
        echo "Erro: ID do Projeto é obrigatório."
        exit 1
    fi
fi
echo "-> Usando o Projeto ID: $PROJECT_ID"

# 3. Construct Service Account email - CORREÇÃO: Usa a conta de serviço "-compute", que é a correta para este tipo de backend.
SERVICE_ACCOUNT="firebase-app-hosting-compute@$PROJECT_ID.iam.gserviceaccount.com"
echo "-> A conta de serviço do Firebase App Hosting é: $SERVICE_ACCOUNT"
echo

# 4. Enable required services
echo "-> Garantindo que os serviços necessários estão ativos..."
gcloud services enable secretmanager.googleapis.com --project="$PROJECT_ID"
gcloud services enable iam.googleapis.com --project="$PROJECT_ID"
echo "Serviços ativados."
echo

# 5. Check if service account exists
echo "-> Verificando se a conta de serviço já existe..."
if ! gcloud iam service-accounts describe "$SERVICE_ACCOUNT" --project="$PROJECT_ID" &> /dev/null; then
    echo "AVISO: A conta de serviço '$SERVICE_ACCOUNT' não foi encontrada."
    echo "Isto é normal na primeira vez. Por favor, execute 'firebase deploy' uma vez (mesmo que falhe) para que o Firebase crie a conta, e depois rode este script novamente."
    exit 1
fi
echo "✅ Conta de serviço encontrada."
echo

# 6. Read .env and process each variable
while IFS='=' read -r key value || [ -n "$key" ]; do
    # Skip comments and empty lines
    if [[ "$key" =~ ^#.*$ ]] || [[ -z "$key" ]]; then
        continue
    fi
    
    # Remove quotes from value if they exist
    value="${value%\"}"
    value="${value#\"}"
    value="${value%\'}"
    value="${value#\'}"
    
    # Sanitize key for Secret Manager (lowercase, hyphens)
    secret_name=$(echo "$key" | tr '[:upper:]' '[:lower:]' | tr '_' '-')
    
    echo "--- Processando variável: $key (Secret: $secret_name) ---"

    # Check if secret already exists
    if gcloud secrets describe "$secret_name" --project="$PROJECT_ID" &> /dev/null; then
        echo "   - Secret '$secret_name' já existe. A atualizar o valor..."
        # Add a new version with the value
        echo -n "$value" | gcloud secrets versions add "$secret_name" --data-file=- --project="$PROJECT_ID" --quiet
        echo "   - Valor do secret atualizado."
    else
        echo "   - Secret '$secret_name' não encontrado. A criar..."
        # Create secret and add the first version
        echo -n "$value" | gcloud secrets create "$secret_name" --replication-policy="automatic" --project="$PROJECT_ID" --data-file=- --quiet
        echo "   - Secret '$secret_name' criado com o valor."
    fi

    # Grant access to the service account
    echo "   - A conceder permissão para a conta de serviço..."
    gcloud secrets add-iam-policy-binding "$secret_name" \
        --member="serviceAccount:$SERVICE_ACCOUNT" \
        --role="roles/secretmanager.secretAccessor" \
        --project="$PROJECT_ID" --quiet
        
    echo "   - Permissão concedida com sucesso."
    echo

done < .env

echo "### ✅ Processo Concluído! ###"
echo "Todos os secrets foram criados e as permissões foram concedidas."
echo "Pode agora executar 'firebase deploy' novamente para finalizar."
