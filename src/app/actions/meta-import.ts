
'use server';

import { getUserIdFromSession, getCompanyIdFromSession } from '@/app/actions';
import { db } from '@/lib/db';
import { users, connections } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { encrypt, decrypt } from '@/lib/crypto';
import { revalidatePath } from 'next/cache';

interface _FacebookAccount {
    id: string;
    name: string;
    access_token: string;
    category?: string;
}

export async function importFacebookConnections() {
    try {
        const userId = await getUserIdFromSession();
        const _companyId = await getCompanyIdFromSession();

        const [user] = await db.select({
            facebookAccessToken: users.facebookAccessToken,
            facebookId: users.facebookId
        }).from(users).where(eq(users.id, userId));

        if (!user || !user.facebookAccessToken) {
            return { success: false, error: "Conecte-se ao Facebook primeiro." };
        }

        // CRITICAL: The token stored in the database is ENCRYPTED. Decrypt before use.
        const userAccessToken = decrypt(user.facebookAccessToken);
        const envAppId = process.env.FACEBOOK_CLIENT_ID || 'TIMESTAMP_PLACEHOLDER';
        const envAppSecret = process.env.FACEBOOK_CLIENT_SECRET || 'SECRET_PLACEHOLDER';
        const foundConnections: any[] = [];
        const diagnosticLogs: string[] = [];

        const log = (msg: string) => {
            console.log(`[MetaImport] ${msg}`);
            diagnosticLogs.push(msg);
        };
        const logError = (msg: string, err?: any) => {
            console.error(`[MetaImport] ${msg}`, err);
            diagnosticLogs.push(`❌ ${msg} ${err ? JSON.stringify(err) : ''}`);
        };
        const logWarn = (msg: string, details?: any) => {
            console.warn(`[MetaImport] ${msg}`, details);
            diagnosticLogs.push(`⚠️ ${msg} ${details ? JSON.stringify(details) : ''}`);
        };

        // Strategy: GRANULAR SAFE-FETCH (The "Line-by-Line" Correction)
        // We cannot trust the Graph API to handle mixed fields (owned + client) gracefully.
        // If one field triggers Code 1 (Unknown Error), the WHOLE request dies.
        // Solution: Split into atomic requests per Business.

        // =====================================================================
        // CRITICAL: Fetch ALL Page Access Tokens upfront using /me/accounts
        // This is the most reliable method. Page Tokens are required for Instagram messaging.
        // =====================================================================
        log(`Fetching Page Access Tokens via /me/accounts...`);
        const pageTokenMap: Record<string, string> = {};

        try {
            const accountsRes = await fetch(`https://graph.facebook.com/v24.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&limit=500&access_token=${userAccessToken}`);
            if (accountsRes.ok) {
                const accountsData = await accountsRes.json();
                const pages = accountsData.data || [];
                log(`Found ${pages.length} Pages with Page Access Tokens`);

                for (const page of pages) {
                    if (page.id && page.access_token) {
                        pageTokenMap[page.id] = page.access_token;
                        log(`  ✅ Page "${page.name}" (${page.id}): Token obtained`);

                        // Also log linked Instagram if any
                        if (page.instagram_business_account) {
                            log(`     📸 Linked IG: @${page.instagram_business_account.username || page.instagram_business_account.id}`);
                        }
                    }
                }
            } else {
                const errText = await accountsRes.text();
                logWarn(`Failed to fetch Page Tokens via /me/accounts: ${accountsRes.status}`, errText);
            }
        } catch (e) {
            logError(`Error fetching Page Tokens:`, e);
        }

        log(`Page Token Map contains ${Object.keys(pageTokenMap).length} tokens`);

        // 1. List Businesses (Lightweight)
        log(`Listing businesses...`);
        const bizListRes = await fetch(`https://graph.facebook.com/v24.0/me/businesses?limit=500&access_token=${userAccessToken}`);

        if (!bizListRes.ok) {
            logError(`Business List Failed:`, await bizListRes.text());
            return { success: false, error: "Falha ao listar empresas do Facebook.", diagnosticLogs };
        }

        const bizData = await bizListRes.json();
        const businesses = bizData.data || [];
        log(`Found ${businesses.length} businesses. Starting Granular Fetch...`);

        // 2. Process Each Business (Granularly)
        const chunkSize = 5; // Lower concurrency to be safe with rate limits (since we do 4 calls per biz)

        for (let i = 0; i < businesses.length; i += chunkSize) {
            const chunk = businesses.slice(i, i + chunkSize);

            await Promise.all(chunk.map(async (biz: any) => {
                const bizId = biz.id;
                const bizName = biz.name;

                // Helper to safely fetch a specific field structure
                const safeFetch = async (edge: string, fields: string) => {
                    try {
                        const url = `https://graph.facebook.com/v24.0/${bizId}?fields=${edge}{${fields}}&access_token=${userAccessToken}`;
                        const res = await fetch(url);
                        if (!res.ok) {
                            const txt = await res.text();
                            logWarn(`Skipped ${edge} for ${bizName}:`, txt);
                            return [];
                        }
                        const json = await res.json();
                        return json[edge]?.data || [];
                    } catch (e) {
                        logError(`Error fetching ${edge} for ${bizName}:`, e);
                        return [];
                    }
                };

                // DIAGNOSTIC: Check permissions granted for this token
                try {
                    const debugRes = await fetch(`https://graph.facebook.com/v24.0/debug_token?input_token=${userAccessToken}&access_token=${envAppId}|${envAppSecret}`);
                    if (debugRes.ok) {
                        const debugData = await debugRes.json();
                        const scopes = debugData.data?.scopes || [];
                        log(`Token Diagnostic for ${bizName}: Scopes=[${scopes.slice(0, 10).join(', ')}...]`);
                        log(`Full Scopes: ${JSON.stringify(scopes)}`);

                        // Validation: Check for mandatory base scopes
                        const mandatory = ['public_profile', 'business_management', 'whatsapp_business_management', 'instagram_basic', 'pages_show_list'];
                        const missing = mandatory.filter(s => !scopes.includes(s));
                        if (missing.length > 0) {
                            logWarn(`CRITICAL: Missing mandatory scopes for ${bizName}:`, missing);
                        } else {
                            log(`✅ All mandatory scopes present for ${bizName}`);
                        }
                    } else {
                        const errText = await debugRes.text();
                        logError(`Debug Token API Failed:`, errText);
                    }
                } catch (e) {
                    logWarn(`Diagnostic failed:`, e);
                }

                // 1. Get Client Business ID for System User context if available
                const meRes = await fetch(`https://graph.facebook.com/v24.0/me?fields=client_business_id,email,name&access_token=${userAccessToken}`);
                const meData = await meRes.json();
                const clientBusinessId = meData.client_business_id;

                log(`Diagnostic: User=${meData.name}, ClientBizID=${clientBusinessId || 'None'}`);

                if (clientBusinessId) {
                    log(`Business ${bizName}: Found Client Business ID: ${clientBusinessId}`);
                    // Fetch System User Tokens if applicable
                    const systemTokensRes = await fetch(`https://graph.facebook.com/v24.0/${clientBusinessId}/system_user_access_tokens?access_token=${userAccessToken}`);
                    if (systemTokensRes.ok) {
                        const _systemTokensData = await systemTokensRes.json();
                        log(`System Tokens discovered for ${bizName}`);
                    }
                }

                // Define fields based on docs
                const wabaFields = 'name,phone_numbers{display_phone_number,id,verified_name,quality_rating}';
                const pageFields = 'name,access_token,tasks,instagram_business_account{id,username,profile_picture_url}';
                const igFields = 'id,username,profile_picture_url';

                // EXECUTE 6 PARALLEL CALLS (Atomic Safety)
                const results = await Promise.all([
                    safeFetch('owned_whatsapp_business_accounts', wabaFields),
                    safeFetch('client_whatsapp_business_accounts', wabaFields),
                    safeFetch('owned_pages', pageFields),
                    safeFetch('client_pages', pageFields),
                    safeFetch('owned_instagram_accounts', igFields),
                    safeFetch('client_instagram_accounts', igFields)
                ]);

                const ownedWabas = results[0] || [];
                const clientWabas = results[1] || [];
                const ownedPages = results[2] || [];
                const clientPages = results[3] || [];
                const ownedIgs = results[4] || [];
                const clientIgs = results[5] || [];

                // Fetch direct IG accounts linked to the user token
                const directUserIgs = await fetch(`https://graph.facebook.com/v24.0/me/instagram_accounts?fields=${igFields}&access_token=${userAccessToken}`)
                    .then(res => res.ok ? res.json() : { data: [] })
                    .then(json => json.data || [])
                    .catch(() => []);

                const allDirectIgs = [...ownedIgs, ...clientIgs, ...directUserIgs];
                if (allDirectIgs.length > 0) log(`Biz ${bizName}: Found ${allDirectIgs.length} Direct IGs`);

                const allPages = [...ownedPages, ...clientPages];
                if (allPages.length > 0) log(`Biz ${bizName}: Found ${allPages.length} Pages`);

                const allWabas = [...ownedWabas, ...clientWabas];
                if (allWabas.length > 0) log(`Biz ${bizName}: Found ${allWabas.length} WABAs`);

                // 1. Process WABAs
                allWabas.forEach((waba: any) => {
                    const phones = waba.phone_numbers?.data || [];
                    phones.forEach((phone: any) => {
                        foundConnections.push({
                            configName: `${bizName} - ${phone.display_phone_number}`,
                            wabaId: waba.id,
                            phoneNumberId: phone.id,
                            displayPhone: phone.display_phone_number,
                            connectionType: 'meta_api',
                            category: 'WhatsApp',
                            accessToken: userAccessToken,
                            appId: envAppId,
                            appSecret: envAppSecret,
                            imported: true
                        });
                    });
                });

                // 2. Process Pages and Linked IGs (Standard + Fallback Strategy)
                await Promise.all(allPages.map(async (page: any) => {
                    const pageName = page.name || 'Unknown Page';
                    const pageId = page.id;

                    // Priority for Page Token:
                    // 1. pageTokenMap (from /me/accounts - most reliable)
                    // 2. Inline token from page object
                    // 3. Token Rescue (explicit fetch)
                    let pageToken = pageTokenMap[pageId] || page.access_token;

                    // Token Rescue: If Page Token is missing, try to fetch it explicitly
                    if (!pageToken) {
                        try {
                            logWarn(`Page ${pageName}: Missing token. Attempting 'Token Rescue'...`);
                            const tokenRes = await fetch(`https://graph.facebook.com/v24.0/${pageId}?fields=access_token&access_token=${userAccessToken}`);
                            if (tokenRes.ok) {
                                const tokenData = await tokenRes.json();
                                if (tokenData.access_token) {
                                    pageToken = tokenData.access_token;
                                    pageTokenMap[pageId] = pageToken; // Cache it
                                    log(`✅ Page ${pageName}: Token Rescue Successful!`);
                                }
                            } else {
                                logWarn(`Page ${pageName}: Token Rescue Failed (${tokenRes.status})`);
                            }
                        } catch (e) {
                            logWarn(`Page ${pageName}: Token Rescue Error`, e);
                        }
                    } else {
                        log(`Page ${pageName}: Using Page Token from /me/accounts`);
                    }

                    // If we STILL have no Page Token, we can't add the "Page" connection safely.
                    // BUT, we might still be able to find the IG using the USER token on the Page Node.

                    if (pageToken) {
                        // Add Page Connection (Only if we have a token)
                        if (!foundConnections.some(c => c.phoneNumberId === pageId)) {
                            foundConnections.push({
                                configName: `Page - ${pageName}`,
                                wabaId: bizId,
                                phoneNumberId: pageId,
                                connectionType: 'facebook_page',
                                category: 'Facebook Page',
                                accessToken: pageToken,
                                appId: envAppId,
                                appSecret: envAppSecret,
                                imported: true,
                                displayPhone: `Page: ${pageName}`
                            });
                        }
                    } else {
                        logWarn(`Page ${pageName}: Skipping Page Import (No Token). Will attempt IG discovery via User Token.`);
                    }

                    // IG Discovery Strategy 1: "Easy Mode" (Already in Page field)
                    if (page.instagram_business_account) {
                        const igId = page.instagram_business_account.id;
                        const igUsername = page.instagram_business_account.username || 'Direct';

                        // CRITICAL: Instagram Messaging API requires PAGE Access Token, NOT User Access Token
                        // Only create connection if we have a valid pageToken
                        if (!pageToken) {
                            logWarn(`Instagram @${igUsername}: Skipping - Page Access Token required for messaging but not available`);
                        } else if (!foundConnections.some(c => c.phoneNumberId === igId)) {
                            foundConnections.push({
                                configName: `Instagram - ${pageName}`,
                                wabaId: pageId,
                                phoneNumberId: igId,
                                connectionType: 'instagram',
                                category: 'Instagram',
                                accessToken: pageToken, // Must be Page Access Token for messaging
                                appId: envAppId,
                                appSecret: envAppSecret,
                                imported: true,
                                displayPhone: `IG: @${igUsername}`
                            });
                            log(`Found Linked IG via Standard Field: @${igUsername} (with Page Token)`);
                        }
                    } else {
                        // IG Discovery Strategy 2: "Hard Mode" (Fetch via Page Token)
                        // If User Token lacks 'instagram_basic', the field above is null.
                        // BUT, the Page Token might still have it!
                        try {
                            // Try modern field first, then legacy 'connected_instagram_account'
                            const igRes = await fetch(`https://graph.facebook.com/v24.0/${pageId}?fields=instagram_business_account{id,username,profile_picture_url},connected_instagram_account{id,username,profile_picture_url}&access_token=${pageToken}`);

                            if (igRes.ok) {
                                const igData = await igRes.json();
                                // Prefer Business Account, fallback to Connected Account
                                const targetIg = igData.instagram_business_account || igData.connected_instagram_account;

                                if (targetIg) {
                                    const igId = targetIg.id;
                                    const igUsername = targetIg.username || 'Fallback';

                                    if (!foundConnections.some(c => c.phoneNumberId === igId)) {
                                        foundConnections.push({
                                            configName: `Instagram - ${pageName}`,
                                            wabaId: pageId,
                                            phoneNumberId: igId,
                                            connectionType: 'instagram',
                                            category: 'Instagram (Fallback)',
                                            accessToken: pageToken,
                                            appId: envAppId,
                                            appSecret: envAppSecret,
                                            imported: true,
                                            displayPhone: `IG: @${igUsername}`
                                        });
                                        log(`✅ FOUND IG via Page Token Fallback: @${igUsername} (Standard scan missed it)`);
                                    }
                                } else {
                                    logWarn(`Page ${pageName}: No linked IG found via Fallback Scan (Fields null).`);
                                }
                            } else {
                                const errTxt = await igRes.text();
                                logWarn(`Page ${pageName}: Fallback IG Fetch Failed (${igRes.status}) - ${errTxt}`);
                            }
                        } catch (e) {
                            logError(`Page ${pageName}: Fallback Logic Error`, e);
                        }
                    }
                }));

                // 3. Process Direct IGs
                // NOTE: Direct IGs discovered via user token CANNOT be used for messaging
                // because Instagram Messaging API requires PAGE Access Token.
                // We only log these for diagnostic purposes but don't create connections.
                if (directUserIgs.length === 0) {
                    logWarn(`Biz ${bizName}: No Direct User IGs found. Ensure 'instagram_basic' is granted.`);
                } else {
                    // Log discovery but don't create messaging connections without Page Token
                    allDirectIgs.forEach((ig: any) => {
                        if (!foundConnections.some(c => c.phoneNumberId === ig.id)) {
                            logWarn(`Instagram @${ig.username}: Found via User Token but cannot create messaging connection (requires Page Token). Link this IG to a Facebook Page and reimport.`);
                        }
                    });
                }
            }));
        }

        return { success: true, connections: foundConnections, diagnosticLogs };

    } catch (error: any) {
        console.error("Auto-Connect Error:", error);
        return { success: false, error: error.message || "Erro desconhecido ao importar conexões.", diagnosticLogs: [] };
    }
}

export async function saveImportedConnections(connectionsToSave: any[]) {
    try {
        const companyId = await getCompanyIdFromSession();
        const currentEnv = process.env.NODE_ENV === 'production' ? 'production' : 'development';

        const saved = [];
        for (const conn of connectionsToSave) {
            // Encrypt tokens
            const encryptedAccessToken = encrypt(conn.accessToken);
            const appSecret = conn.appSecret === 'SECRET_PLACEHOLDER'
                ? process.env.FACEBOOK_CLIENT_SECRET || ''
                : conn.appSecret;
            const encryptedAppSecret = encrypt(appSecret);
            const appId = conn.appId === 'TIMESTAMP_PLACEHOLDER'
                ? process.env.FACEBOOK_CLIENT_ID || ''
                : conn.appId;

            // Check if exists
            const [existing] = await db.select().from(connections)
                .where(and(
                    eq(connections.companyId, companyId),
                    eq(connections.phoneNumberId, conn.phoneNumberId)
                ));

            if (!existing) {
                const [newConn] = await db.insert(connections).values({
                    companyId,
                    config_name: conn.configName,
                    connectionType: conn.connectionType || 'meta_api',
                    wabaId: conn.wabaId,
                    phoneNumberId: conn.phoneNumberId,
                    appId: appId,
                    accessToken: encryptedAccessToken,
                    webhookSecret: 'auto_generated',
                    appSecret: encryptedAppSecret,
                    isActive: true, // Auto-activate imported
                    environment: currentEnv
                }).returning();
                saved.push(newConn);
            } else {
                // Self-Healing: Update token if connection already exists
                // This allows fixing "Missing Token" issues by simply re-importing
                if (conn.accessToken) {
                    // SECURITY: Validar tenant ao atualizar (existing já foi buscado com companyId)
                    await db.update(connections)
                        .set({
                            accessToken: encryptedAccessToken,
                            isActive: true, // Reactivate
                            config_name: conn.configName // Update name in case it changed
                        })
                        .where(and(
                            eq(connections.id, existing.id),
                            eq(connections.companyId, companyId)
                        ));
                    saved.push(existing); // Count as processed/saved
                }
            }
        }

        revalidatePath('/connections');
        return { success: true, count: saved.length };

    } catch (error: any) {
        console.error("Save Import Error:", error);
        return { success: false, error: error.message };
    }
}
