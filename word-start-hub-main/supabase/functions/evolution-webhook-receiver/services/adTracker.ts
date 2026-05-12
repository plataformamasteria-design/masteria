export async function extractAdTrackingData(params: {
    supabase: any;
    organizationId: string;
    message: any;
    data: any;
    content: string | null;
    fromMe: boolean;
    messageType: string;
}) {
    const { supabase, organizationId, message, data, content, fromMe, messageType } = params;

    let adId: string | null = null;
    let sourceUrl: string | null = null;
    try {
        // Evolution standardizes the message type, but data.message has the actual object (e.g. data.message.extendedTextMessage, data.message.imageMessage)
        const rawMsgType = Object.keys(message || {}).find(k => k !== 'messageContextInfo' && k !== 'senderKeyDistributionMessage') || 'conversation';
        const typedMessage = message?.[rawMsgType] || message;
        const contextInfo = typedMessage?.contextInfo || message?.contextInfo || data.contextInfo;

        if (data.referral?.source_id) {
            adId = String(data.referral.source_id);
        } else if (data.referral?.ad_id) {
            adId = String(data.referral.ad_id);
        } else if (contextInfo?.adReply?.sourceId) {
            adId = String(contextInfo.adReply.sourceId);
        } else if (contextInfo?.adReply?.adId) {
            adId = String(contextInfo.adReply.adId);
        } else if (contextInfo?.sourceId) {
            adId = String(contextInfo.sourceId);
        } else if (contextInfo?.adId) {
            adId = String(contextInfo.adId);
        }

        // Also try to get source_url as sometimes Meta only sends the URL
        if (data.referral?.source_url) {
            sourceUrl = String(data.referral.source_url);
            // sourceUrls usually contain ad_id=123 in the querystring
            try {
                const urlObj = new URL(sourceUrl);
                const extractedAdId = urlObj.searchParams.get('ad_id');
                if (extractedAdId && !adId) adId = extractedAdId;
            } catch (e) {
                // ignore invalid url error
            }
        } else if (contextInfo?.externalAdReply?.sourceUrl) {
            sourceUrl = String(contextInfo.externalAdReply.sourceUrl);
        } else if (contextInfo?.adReply?.sourceUrl) {
            sourceUrl = String(contextInfo.adReply.sourceUrl);
        } else if (contextInfo?.sourceUrl) {
            sourceUrl = String(contextInfo.sourceUrl);
        }
    } catch (adExtractErr) {
        console.error('[evolution-webhook-receiver] Failed to extract ad data:', adExtractErr);
    }

    let adsetId: string | null = null;
    let campaignId: string | null = null;
    let adName: string | null = null;
    let campaignName: string | null = null;

    if (adId || sourceUrl) {
        console.log(`[evolution-webhook-receiver] Extracted Ad ID: ${adId}, Source URL: ${sourceUrl}. Looking up campaign in DB...`);
        try {
            const { data: matchedCampaigns } = await supabase
                .from('marketing_campaigns')
                .select('campaign_id, campaign_name, raw_data')
                .eq('organization_id', organizationId)
                .eq('platform', 'meta_ads');

            if (matchedCampaigns && matchedCampaigns.length > 0) {
                let foundMatch = false;
                for (const camp of matchedCampaigns) {
                    const raw = camp.raw_data as any;
                    if (raw && raw.ads && Array.isArray(raw.ads)) {
                        // Try exact adId matching first
                        let matchedAd = null;
                        if (adId) {
                            matchedAd = raw.ads.find((a: any) => String(a.ad_id) === adId || String(a.id) === adId);
                        }
                        // If ad_id fails but we have sourceUrl, try to match by ad link
                        if (!matchedAd && sourceUrl) {
                            // Not perfectly reliable as ads API might not include the full link in basic insight, but fallback string matching
                            matchedAd = raw.ads.find((a: any) => {
                                const adStr = JSON.stringify(a).toLowerCase();
                                return sourceUrl && adStr.includes(sourceUrl.toLowerCase());
                            });
                        }

                        if (matchedAd) {
                            campaignId = camp.campaign_id;
                            campaignName = camp.campaign_name;
                            adsetId = matchedAd.adset_id;
                            adName = matchedAd.ad_name || matchedAd.name;
                            console.log(`[evolution-webhook-receiver] Match found! Campaign: ${campaignName}, Ad: ${adName}`);
                            foundMatch = true;
                            break;
                        }
                    }
                }
                if (!foundMatch && adId) {
                    console.log(`[evolution-webhook-receiver] Ad ID ${adId} extracted but not found in synced marketing_campaigns.`);
                }
            }
        } catch (lookupErr) {
            console.error('[evolution-webhook-receiver] Ad lookup error:', lookupErr);
        }
    }

    // ------> TEXT-BASED FALLBACK: Match message content against synced ad autofill texts <------
    // Only applies when we couldn't identify the ad via hidden metadata (or when metadata failed to match)
    if (!campaignId && content && !fromMe && (messageType === 'text' || messageType === 'conversation')) {
        try {
            const trimmedContent = content.trim();
            if (trimmedContent.length >= 10) { // Only match reasonably long messages
                const { data: allCampaigns } = await supabase
                    .from('marketing_campaigns')
                    .select('campaign_id, campaign_name, raw_data')
                    .eq('organization_id', organizationId)
                    .eq('platform', 'meta_ads');

                if (allCampaigns && allCampaigns.length > 0) {
                    let textMatchFound = false;
                    for (const camp of allCampaigns) {
                        const raw = camp.raw_data as any;
                        if (!raw?.ads || !Array.isArray(raw.ads)) continue;

                        for (const ad of raw.ads) {
                            const autofill = ad.autofill_message;
                            if (!autofill || typeof autofill !== 'string') continue;

                            const autofillTrimmed = autofill.trim();
                            // Strip bracket suffixes like [A1], [B1], [B2] for fuzzy matching across ad variants
                            const stripVariantTag = (s: string) => s.replace(/\s*\[[A-Z0-9]+\]\s*$/, '').trim();
                            const contentBase = stripVariantTag(trimmedContent);
                            const autofillBase = stripVariantTag(autofillTrimmed);
                            // Match if the incoming message starts with the autofill text
                            // (user may append extra text after the pre-filled message)
                            // Also match if base texts (without variant tags) are the same
                            if (trimmedContent.startsWith(autofillTrimmed) || autofillTrimmed.startsWith(trimmedContent) || (contentBase.length >= 10 && (contentBase.startsWith(autofillBase) || autofillBase.startsWith(contentBase)))) {
                                adId = String(ad.ad_id || ad.id);
                                campaignId = camp.campaign_id;
                                campaignName = camp.campaign_name;
                                adsetId = ad.adset_id || null;
                                adName = ad.ad_name || ad.name || null;
                                console.log(`[evolution-webhook-receiver] TEXT MATCH! Message matched autofill of ad "${adName}" in campaign "${campaignName}"`);
                                textMatchFound = true;
                                break;
                            }
                        }
                        if (textMatchFound) break;
                    }
                }
            }
        } catch (textMatchErr) {
            console.error('[evolution-webhook-receiver] Text-based ad match error:', textMatchErr);
        }
    }

    return { adId, sourceUrl, adsetId, campaignId, adName, campaignName };
}
