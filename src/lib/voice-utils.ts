export type VoiceCallOutcome = 'human' | 'voicemail' | 'no_answer' | 'busy' | 'failed' | 'pending';

export function mapDisconnectionReasonToOutcome(disconnectionReason: string | null | undefined): VoiceCallOutcome {
    if (!disconnectionReason) return 'pending';
    
    const reason = disconnectionReason.toLowerCase();
    
    if (reason === 'voicemail_reached' || reason.includes('voicemail')) {
        return 'voicemail';
    }
    if (reason === 'user_hangup' || reason === 'agent_hangup' || reason === 'call_ended' || reason === 'call_transfer') {
        return 'human';
    }
    if (reason === 'no_answer' || reason.includes('no_answer') || reason === 'machine_detected_end') {
        return 'no_answer';
    }
    if (reason === 'busy' || reason.includes('busy')) {
        return 'busy';
    }
    if (reason.includes('error') || reason.includes('fail')) {
        return 'failed';
    }
    
    return 'human';
}

export const VOICE_MAX_RETRY_ATTEMPTS = 3;
export const VOICE_RETRY_DELAY_MINUTES = 30;
