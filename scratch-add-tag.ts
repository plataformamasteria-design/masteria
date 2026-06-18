import { Client } from 'pg';

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  await client.connect();

  const campaignId = 'a92b6169-ca99-41c9-9c61-feac6a0d419c';

  // Get company ID
  const campaignRes = await client.query(`SELECT company_id FROM campaigns WHERE id = $1`, [campaignId]);
  if (campaignRes.rows.length === 0) {
    console.error('Campaign not found');
    process.exit(1);
  }
  const companyId = campaignRes.rows[0].company_id;
  console.log(`Company ID: ${companyId}`);

  const tagName = 'GUILHERME';

  // Check if tag exists
  let tagRes = await client.query(`SELECT id FROM tags WHERE company_id = $1 AND name ILIKE $2`, [companyId, tagName]);
  let tagId;
  
  if (tagRes.rows.length === 0) {
    console.log(`Tag '${tagName}' not found. Creating it...`);
    // Insert tag
    const insertTagRes = await client.query(
      `INSERT INTO tags (company_id, name, color) VALUES ($1, $2, $3) RETURNING id`,
      [companyId, tagName, '#10B981'] // default color green
    );
    tagId = insertTagRes.rows[0].id;
  } else {
    tagId = tagRes.rows[0].id;
    console.log(`Tag '${tagName}' found with ID: ${tagId}`);
  }

  // Get all contact IDs from whatsapp_delivery_reports for this campaign
  console.log(`Fetching contacts for campaign...`);
  const contactsRes = await client.query(`SELECT DISTINCT contact_id FROM whatsapp_delivery_reports WHERE campaign_id = $1`, [campaignId]);
  
  const contactIds = contactsRes.rows.map(r => r.contact_id).filter(id => id); // filter out nulls
  console.log(`Found ${contactIds.length} unique contacts targeted by this campaign.`);

  // Insert into contacts_to_tags
  let addedCount = 0;
  for (let i = 0; i < contactIds.length; i += 100) {
    const batch = contactIds.slice(i, i + 100);
    const values: string[] = [];
    const flatParams: any[] = [];
    
    batch.forEach((cid, index) => {
      values.push(`($${index * 2 + 1}, $${index * 2 + 2})`);
      flatParams.push(cid, tagId);
    });

    const query = `
      INSERT INTO contacts_to_tags (contact_id, tag_id)
      VALUES ${values.join(', ')}
      ON CONFLICT DO NOTHING
    `;

    const res = await client.query(query, flatParams);
    addedCount += res.rowCount || 0;
  }

  console.log(`Successfully added tag to ${addedCount} contacts (ignored duplicates).`);

  await client.end();
}

main().catch(console.error);
