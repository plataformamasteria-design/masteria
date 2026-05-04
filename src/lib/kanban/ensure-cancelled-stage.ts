/**
 * Helper function to ensure "Agendamento Desmarcado" stage exists
 * when a board has a "meeting_scheduled" stage
 */

import { v4 as uuidv4 } from 'uuid';

export interface KanbanStage {
    id: string;
    title: string;
    type: 'NEUTRAL' | 'WIN' | 'LOSS';
    semanticType?: 'meeting_scheduled' | 'meeting_cancelled' | 'payment_received' | 'proposal_sent';
    position: number;
}

/**
 * Auto-inserts "Agendamento Desmarcado" stage BEFORE "Reunião Marcada"
 * if it doesn't already exist
 */
export function ensureCancelledStage(stages: KanbanStage[]): KanbanStage[] {
    // 1. Find index of "meeting_scheduled" stage
    const meetingIdx = stages.findIndex(s => s.semanticType === 'meeting_scheduled');

    if (meetingIdx === -1) {
        // No meeting stage, nothing to do
        return stages.map((s, idx) => ({ ...s, position: idx }));
    }

    // 2. Check if "meeting_cancelled" already exists BEFORE it
    const hasCancelled = stages.some(s => s.semanticType === 'meeting_cancelled');

    if (hasCancelled) {
        // Already exists, just reindex positions
        return stages.map((s, idx) => ({ ...s, position: idx }));
    }

    // 3. Create new "Agendamento Desmarcado" stage
    const cancelledStage: KanbanStage = {
        id: uuidv4(),
        title: 'Agendamento Desmarcado',
        type: 'NEUTRAL',
        semanticType: 'meeting_cancelled',
        position: meetingIdx, // Will be inserted at meeting position, pushing meeting +1
    };

    // 4. Insert BEFORE meeting_scheduled
    const newStages = [...stages];
    newStages.splice(meetingIdx, 0, cancelledStage);

    // 5. Reindex all positions
    return newStages.map((s, idx) => ({ ...s, position: idx }));
}
