
import { db } from '@/lib/db';
import { 
  companies, 
  companyQuotas, 
  aiCredentials, 
  companyFeatureAccess, 
  features,
  aiPersonas
} from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

async function investigateCompanies() {
  console.log('🔍 Starting comprehensive company investigation...');

  try {
    // Ensure reports directory exists
    const reportDir = path.join(process.cwd(), 'reports');
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir);
    }

    // Fetch all companies
    const allCompanies = await db.select().from(companies);
    console.log(`Found ${allCompanies.length} companies.`);

    const reportData = [];

    for (const company of allCompanies) {
      console.log(`Processing company: ${company.name} (${company.id})`);

      // Fetch Quotas
      const quotas = await db.select().from(companyQuotas).where(eq(companyQuotas.companyId, company.id));
      
      // Fetch AI Credentials
      const credentials = await db.select().from(aiCredentials).where(eq(aiCredentials.companyId, company.id));
      const safeCredentials = credentials.map(cred => ({
        ...cred,
        apiKey: cred.apiKey ? `${cred.apiKey.substring(0, 4)}...${cred.apiKey.substring(cred.apiKey.length - 4)}` : 'N/A'
      }));

      // Fetch Features
      const featureAccess = await db
        .select({
          featureName: features.name,
          featureKey: features.key,
          isActive: companyFeatureAccess.isActive,
          accessLevel: companyFeatureAccess.accessLevel
        })
        .from(companyFeatureAccess)
        .innerJoin(features, eq(companyFeatureAccess.featureId, features.id))
        .where(eq(companyFeatureAccess.companyId, company.id));

      // Fetch AI Personas (System Prompts context)
      const personas = await db.select({
        name: aiPersonas.name,
        model: aiPersonas.model,
        provider: aiPersonas.provider,
        isActive: aiPersonas.isTriggerActive
      }).from(aiPersonas).where(eq(aiPersonas.companyId, company.id));

      reportData.push({
        company: {
          id: company.id,
          name: company.name,
          webhookSlug: company.webhookSlug,
          aiModel: company.aiModel,
          aiKnowledgeBase: company.aiKnowledgeBase ? 'Configured (Content Hidden)' : 'Not Configured',
          mksmsApiToken: company.mksmsApiToken ? 'Configured (Hidden)' : 'Not Configured',
          createdAt: company.createdAt,
        },
        quotas: quotas[0] || 'No Quotas Defined',
        credentials: safeCredentials,
        features: featureAccess,
        personas: personas
      });
    }

    // Write Report
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = path.join(reportDir, `companies-investigation-report-${timestamp}.json`);
    const latestReportPath = path.join(reportDir, `companies-investigation-report.json`);
    
    fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
    fs.writeFileSync(latestReportPath, JSON.stringify(reportData, null, 2)); // Save as latest for easy access

    console.log(`\n✅ Investigation complete!`);
    console.log(`📄 Detailed report saved to: ${reportPath}`);
    
    // Print Summary
    console.log('\n=== INVESTIGATION SUMMARY ===');
    reportData.forEach((data, index) => {
      console.log(`\n[${index + 1}] Company: ${data.company.name}`);
      console.log(`    ID: ${data.company.id}`);
      console.log(`    Webhook Slug: ${data.company.webhookSlug}`);
      console.log(`    AI Model: ${data.company.aiModel || 'Default'}`);
      console.log(`    Quotas: Messages ${data.quotas.currentMessagesMonth}/${data.quotas.maxMessagesPerMonth || '?'} | AI Tokens ${data.quotas.currentAiTokensMonth}/${data.quotas.maxAiTokens || '?'}`);
      console.log(`    Active Personas: ${data.personas.length}`);
      console.log(`    AI Credentials: ${data.credentials.length} configured`);
    });
    console.log('\n=============================');

  } catch (error) {
    console.error('❌ Error investigating companies:', error);
  } finally {
    process.exit(0);
  }
}

investigateCompanies();
