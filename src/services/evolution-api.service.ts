import { db } from '@/lib/db';

export interface EvolutionApiConfig {
    url: string;
    apiKey: string;
}

export class EvolutionApiService {
    private getConfig(): EvolutionApiConfig {
        const url = process.env.EVOLUTION_API_URL;
        const apiKey = process.env.EVOLUTION_API_KEY;

        if (!url || !apiKey) {
            throw new Error('Evolution API não configurada. Verifique EVOLUTION_API_URL e EVOLUTION_API_KEY no .env');
        }

        return {
            url: url.replace(/\/$/, ''),
            apiKey,
        };
    }

    async createInstance(instanceName: string) {
        const config = this.getConfig();
        const payload = {
            instanceName,
            qrcode: true,
            integration: 'WHATSAPP-BAILEYS', // Required by Evolution API for standard WhatsApp
        };

        const doCreate = async () => {
            return await fetch(`${config.url}/instance/create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': config.apiKey,
                },
                body: JSON.stringify(payload),
            });
        };

        let response = await doCreate();

        if (!response.ok) {
            const errorText = await response.text();
            
            if (errorText.includes('is already in use') || errorText.includes('já está em uso')) {
                console.log(`[Evolution API] Instance ${instanceName} already in use. Retrying delete and wait...`);
                await this.deleteInstance(instanceName).catch(() => {});
                
                // Wait for deletion to propagate (up to 5 seconds)
                for (let i = 0; i < 5; i++) {
                    await new Promise(r => setTimeout(r, 1000));
                    const status = await this.getConnectionState(instanceName).catch(() => ({ instance: { state: 'not_found' } }));
                    if (status?.instance?.state === 'not_found') break;
                }

                response = await doCreate();
                if (!response.ok) {
                    const retryError = await response.text();
                    throw new Error(`Failed to create instance after retry: ${retryError}`);
                }
            } else {
                throw new Error(`Failed to create instance: ${errorText}`);
            }
        }

        return response.json();
    }

    async setWebhook(instanceName: string, webhookUrl: string) {
        const config = this.getConfig();
        
        // As per Evolution API contracts, webhook configuration requires specific events
        const events = [
            'APPLICATION_STARTUP',
            'QRCODE_UPDATED',
            'MESSAGES_SET',
            'MESSAGES_UPSERT',
            'MESSAGES_UPDATE',
            'MESSAGES_DELETE',
            'SEND_MESSAGE',
            'CONTACTS_SET',
            'CONTACTS_UPSERT',
            'CONTACTS_UPDATE',
            'PRESENCE_UPDATE',
            'CHATS_SET',
            'CHATS_UPSERT',
            'CHATS_UPDATE',
            'CHATS_DELETE',
            'GROUPS_UPSERT',
            'GROUP_UPDATE',
            'GROUP_PARTICIPANTS_UPDATE',
            'CONNECTION_UPDATE',
            'CALL'
        ];

        // Robust payload attempts for different Evolution API versions
        const payloads = [
            {
                webhook: {
                    enabled: true,
                    url: webhookUrl,
                    webhookByEvents: false,
                    webhookBase64: false,
                    byEvents: false,
                    base64: false,
                    events,
                }
            },
            {
                enabled: true,
                url: webhookUrl,
                webhookByEvents: false,
                webhookBase64: false,
                byEvents: false,
                base64: false,
                events,
            },
            {
                url: webhookUrl,
                webhook_by_events: false,
                webhook_base64: false,
                events,
            }
        ];

        let lastError = '';

        for (const payload of payloads) {
            try {
                const response = await fetch(`${config.url}/webhook/set/${instanceName}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': config.apiKey,
                    },
                    body: JSON.stringify(payload),
                });

                if (response.ok) {
                    console.log(`[Evolution API] Webhook configured successfully for ${instanceName}`);
                    return await response.json();
                } else {
                    lastError = await response.text();
                }
            } catch (err: any) {
                lastError = err.message || String(err);
            }
        }

        throw new Error(`Failed to set webhook after multiple attempts: ${lastError}`);
    }

    async getConnectionState(instanceName: string) {
        const config = this.getConfig();
        const response = await fetch(`${config.url}/instance/connectionState/${instanceName}`, {
            method: 'GET',
            headers: {
                'apikey': config.apiKey,
            },
        });

        if (response.status === 404) {
            return { instance: { state: 'not_found' } };
        }

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to get connection state: ${errorText}`);
        }

        return response.json();
    }

    async getConnectionData(instanceName: string) {
        const config = this.getConfig();
        const response = await fetch(`${config.url}/instance/connect/${instanceName}`, {
            method: 'GET',
            headers: {
                'apikey': config.apiKey,
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to get connection data: ${errorText}`);
        }

        return response.json(); // contains base64/qrcode
    }

    async deleteInstance(instanceName: string) {
        const config = this.getConfig();
        const response = await fetch(`${config.url}/instance/delete/${instanceName}`, {
            method: 'DELETE',
            headers: {
                'apikey': config.apiKey,
            },
        });

        if (!response.ok && response.status !== 404) {
            const errorText = await response.text();
            throw new Error(`Failed to delete instance: ${errorText}`);
        }

        return { success: true };
    }

    async logoutInstance(instanceName: string) {
        const config = this.getConfig();
        const response = await fetch(`${config.url}/instance/logout/${instanceName}`, {
            method: 'DELETE',
            headers: {
                'apikey': config.apiKey,
            },
        });

        if (!response.ok && response.status !== 404) {
            const errorText = await response.text();
            console.warn(`Logout instance failed (might not be connected): ${errorText}`);
        }

        return { success: true };
    }

    async sendMessage(instanceName: string, number: string, text: string) {
        const config = this.getConfig();
        const response = await fetch(`${config.url}/message/sendText/${instanceName}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': config.apiKey,
            },
            body: JSON.stringify({
                number,
                text,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to send message: ${errorText}`);
        }

        return response.json();
    }

    async sendMedia(instanceName: string, number: string, mediaType: 'image' | 'video' | 'audio' | 'document', urlOrBase64: string, caption?: string, fileName?: string) {
        const config = this.getConfig();
        
        const isUrl = urlOrBase64.startsWith('http');
        const mediaField = urlOrBase64; // already data:mime... or URL
        
        if (mediaType === 'audio') {
            const body: any = {
                number,
                audio: mediaField,
                delay: 100
            };

            const response = await fetch(`${config.url}/message/sendWhatsAppAudio/${instanceName}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': config.apiKey,
                },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to send audio: ${errorText}`);
            }

            return response.json();
        }

        const body: any = {
            number,
            mediatype: mediaType,
            media: mediaField,
        };

        if (caption) body.caption = caption;
        if (fileName) body.fileName = fileName;

        const response = await fetch(`${config.url}/message/sendMedia/${instanceName}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': config.apiKey,
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to send media: ${errorText}`);
        }

        return response.json();
    }

    async fetchProfilePictureUrl(instanceName: string, number: string) {
        const config = this.getConfig();
        try {
            const response = await fetch(`${config.url}/chat/fetchProfilePictureUrl/${instanceName}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': config.apiKey,
                },
                body: JSON.stringify({ number })
            });

            if (!response.ok) {
                return null;
            }

            const data = await response.json();
            return data?.profilePictureUrl || null;
        } catch (e) {
            console.error(`[Evolution API] Falha ao buscar avatar de ${number}`, e);
            return null;
        }
    }

    async fetchGroups(instanceName: string) {
        const config = this.getConfig();
        // Uses standard Evolution API route to get all participating groups
        const response = await fetch(`${config.url}/group/fetchAllParticipating/${instanceName}?getParticipants=false`, {
            method: 'GET',
            headers: {
                'apikey': config.apiKey,
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to fetch groups: ${errorText}`);
        }

        return response.json();
    }
}

export const evolutionApiService = new EvolutionApiService();
