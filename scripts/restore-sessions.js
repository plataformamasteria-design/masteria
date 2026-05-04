const AdmZip = require('adm-zip');
const fs = require('fs');
const path = require('path');

const targetDir = '/app/zapmaster/baileys_auth';
const zipFilePath = path.join(process.cwd(), 'whatsapp_sessions_backup.zip');
const doneFilePath = path.join(process.cwd(), 'whatsapp_sessions_backup_done.zip');

console.log('[SESSIONS SYNC] Verificando se há sessões do WhatsApp para descompactar...');

try {
    if (fs.existsSync(zipFilePath)) {
        console.log('[SESSIONS SYNC] Arquivo de backup encontrado! Descompactando...');

        // Garantir que a pasta alvo existe
        if (!fs.existsSync(targetDir)) {
            console.log(`[SESSIONS SYNC] Criando diretório de destino: ${targetDir}`);
            fs.mkdirSync(targetDir, { recursive: true });
        }

        // Descompactar as sessões usando adm-zip
        const zip = new AdmZip(zipFilePath);
        zip.extractAllTo(targetDir, true);

        console.log(`[SESSIONS SYNC] Sucesso! ${zip.getEntries().length} arquivos descompactados em ${targetDir}.`);

        // Renomeia o arquivo para não rodar duas vezes no próximo restart se o container for o mesmo
        try {
            fs.renameSync(zipFilePath, doneFilePath);
            console.log('[SESSIONS SYNC] Backup renomeado para evitar duplicação.');
        } catch (e) {
            console.log('[SESSIONS SYNC] Aviso: Não foi possível renomear o zip:', e.message);
        }
    } else {
        console.log('[SESSIONS SYNC] Nenhum backup pendente encontrado. Tudo pronto.');
    }
} catch (error) {
    console.error('[SESSIONS SYNC] ERRO CRÍTICO ao descompactar:', error);
}
