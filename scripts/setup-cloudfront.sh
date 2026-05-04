#!/bin/bash

# Configuração do CloudFront para Master IA
# Execute: chmod +x scripts/setup-cloudfront.sh && ./scripts/setup-cloudfront.sh

set -e

# Variáveis (configure antes de executar)
BUCKET_NAME="${AWS_S3_BUCKET_NAME}"
AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID}"
REGION="${AWS_REGION:-us-east-1}"

if [ -z "$BUCKET_NAME" ] || [ -z "$AWS_ACCOUNT_ID" ]; then
    echo "❌ Configure as variáveis AWS_S3_BUCKET_NAME e AWS_ACCOUNT_ID"
    exit 1
fi

echo "🚀 Configurando CloudFront para bucket: $BUCKET_NAME"

# 1. Criar Origin Access Control
echo "📝 Criando Origin Access Control..."
OAC_ID=$(aws cloudfront create-origin-access-control \
    --origin-access-control-config \
    Name="master-ia-s3-oac",Description="OAC for Master IA S3",OriginAccessControlOriginType="s3",SigningBehavior="always",SigningProtocol="sigv4" \
    --query 'OriginAccessControl.Id' --output text)

echo "✅ OAC criado: $OAC_ID"

# 2. Criar distribuição CloudFront
echo "📡 Criando distribuição CloudFront..."
DISTRIBUTION_CONFIG=$(cat <<EOF
{
    "CallerReference": "master-ia-$(date +%s)",
    "Comment": "Master IA Media Distribution",
    "DefaultCacheBehavior": {
        "TargetOriginId": "S3-$BUCKET_NAME",
        "ViewerProtocolPolicy": "redirect-to-https",
        "AllowedMethods": {
            "Quantity": 7,
            "Items": ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"],
            "CachedMethods": {
                "Quantity": 2,
                "Items": ["GET", "HEAD"]
            }
        },
        "ForwardedValues": {
            "QueryString": false,
            "Cookies": {"Forward": "none"}
        },
        "TrustedSigners": {
            "Enabled": false,
            "Quantity": 0
        },
        "MinTTL": 0,
        "DefaultTTL": 86400,
        "MaxTTL": 31536000
    },
    "Origins": {
        "Quantity": 1,
        "Items": [
            {
                "Id": "S3-$BUCKET_NAME",
                "DomainName": "$BUCKET_NAME.s3.$REGION.amazonaws.com",
                "S3OriginConfig": {
                    "OriginAccessIdentity": ""
                },
                "OriginAccessControlId": "$OAC_ID"
            }
        ]
    },
    "Enabled": true,
    "PriceClass": "PriceClass_All"
}
EOF
)

DISTRIBUTION_ID=$(aws cloudfront create-distribution \
    --distribution-config "$DISTRIBUTION_CONFIG" \
    --query 'Distribution.Id' --output text)

echo "✅ Distribuição criada: $DISTRIBUTION_ID"

# 3. Obter domain name da distribuição
DOMAIN_NAME=$(aws cloudfront get-distribution \
    --id "$DISTRIBUTION_ID" \
    --query 'Distribution.DomainName' --output text)

echo "🌐 Domain CloudFront: $DOMAIN_NAME"

# 4. Atualizar bucket policy
echo "🔒 Atualizando bucket policy..."
BUCKET_POLICY=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudFrontServicePrincipal",
      "Effect": "Allow",
      "Principal": {
        "Service": "cloudfront.amazonaws.com"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::$BUCKET_NAME/*",
      "Condition": {
        "StringEquals": {
          "AWS:SourceArn": "arn:aws:cloudfront::$AWS_ACCOUNT_ID:distribution/$DISTRIBUTION_ID"
        }
      }
    }
  ]
}
EOF
)

echo "$BUCKET_POLICY" | aws s3api put-bucket-policy \
    --bucket "$BUCKET_NAME" \
    --policy file:///dev/stdin

echo "✅ Bucket policy atualizada"

# 5. Aguardar deploy (pode demorar 15-20 minutos)
echo "⏳ Aguardando deploy da distribuição..."
aws cloudfront wait distribution-deployed --id "$DISTRIBUTION_ID"

echo "🎉 CloudFront configurado com sucesso!"
echo ""
echo "📋 Informações importantes:"
echo "   Distribution ID: $DISTRIBUTION_ID"
echo "   Domain Name: $DOMAIN_NAME"
echo "   OAC ID: $OAC_ID"
echo ""
echo "🔧 Adicione ao seu .env:"
echo "   AWS_CLOUDFRONT_DOMAIN=$DOMAIN_NAME"
echo ""
echo "⚠️  O deploy pode levar até 20 minutos para ficar totalmente ativo."