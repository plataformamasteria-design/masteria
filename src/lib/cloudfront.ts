// src/lib/cloudfront.ts
import { CloudFrontClient, CreateInvalidationCommand } from '@aws-sdk/client-cloudfront';

const getCloudFrontClient = (): CloudFrontClient => {
    return new CloudFrontClient({
        region: process.env.AWS_REGION || 'us-east-1',
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        }
    });
};

// Invalidar cache do CloudFront
export async function invalidateCloudFrontCache(paths: string[]): Promise<string> {
    const distributionId = process.env.AWS_CLOUDFRONT_DISTRIBUTION_ID;
    if (!distributionId) {
        throw new Error('AWS_CLOUDFRONT_DISTRIBUTION_ID não configurado');
    }

    const client = getCloudFrontClient();
    const command = new CreateInvalidationCommand({
        DistributionId: distributionId,
        InvalidationBatch: {
            Paths: {
                Quantity: paths.length,
                Items: paths,
            },
            CallerReference: `invalidation-${Date.now()}`,
        },
    });

    const response = await client.send(command);
    return response.Invalidation?.Id || '';
}

// Invalidar mídia específica
export async function invalidateMediaFile(s3Key: string): Promise<void> {
    const path = `/${s3Key}`;
    await invalidateCloudFrontCache([path]);
}