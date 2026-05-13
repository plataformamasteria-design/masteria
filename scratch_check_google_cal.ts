import { db, conn } from './src/lib/db/index.js';
import { googleCalendarCredentials, companies, users } from './src/lib/db/schema.js';
import { eq, ilike, or } from 'drizzle-orm';
import { googleCalendarService } from './src/services/google-calendar.service.js';

async function check() {
  try {
    // Buscar a company do douglas resende ou hills corretora
    const companyList = await db.select().from(companies).where(
      or(
        ilike(companies.name, '%douglas%'),
        ilike(companies.name, '%hills%')
      )
    );
    
    console.log("Companies found:", companyList.map(c => ({ id: c.id, name: c.name })));

    for (const company of companyList) {
      const [cred] = await db.select().from(googleCalendarCredentials).where(eq(googleCalendarCredentials.companyId, company.id));
      if (cred) {
        console.log(`\nCredential found for company ${company.name} (${company.id})`);
        console.log(`isActive: ${cred.isActive}`);
        console.log(`tokenExpiry: ${cred.tokenExpiry}`);
        
        try {
          console.log("Attempting to list calendars from Google API...");
          const calendars = await googleCalendarService.listCalendars(company.id);
          console.log(`Success! Found ${calendars.length} calendars.`);
        } catch (e: any) {
          console.error(`Error listing calendars for company ${company.id}:`, e.message);
        }
      } else {
        console.log(`\nNo credential found for company ${company.name} (${company.id})`);
      }
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await conn.end();
  }
}

check();
