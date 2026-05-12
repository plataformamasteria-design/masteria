export interface Tag {
    id: string;
    name: string;
    color: string;
    order_position?: number | null;
}

export interface AssignedProfile {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
}

export interface AssignedTeam {
    id: string;
    name: string;
}

export interface CalendarEvent {
    id: string;
    title: string;
    start_time: string;
    end_time: string;
    description: string | null;
    assigned_to: string | null;
    assigned_profile?: AssignedProfile | null;
}

export interface Task {
    id: string;
    title: string;
    due_date: string | null;
    due_time: string | null;
    priority: string | null;
    completed: boolean | null;
    description: string | null;
    assigned_to: string | null;
    assigned_profile?: AssignedProfile | null;
}

export interface Chat {
    id: string;
    phone: string;
    wa_name: string | null;
    wa_photo_url: string | null;
    custom_name?: string | null;
    name_locked?: boolean;
    is_group?: boolean;
    group_name?: string | null;
    group_photo_url?: string | null;
    group_description?: string | null;
    participant_count?: number | null;
    last_message: string | null;
    agent_off: boolean;
    assigned_to: string | null;
    team_id: string | null;
    assigned_profile?: AssignedProfile | null;
    assigned_team?: AssignedTeam | null;
    tags: Tag[];
    organization_id?: string;
}

export interface Transaction {
    id: string;
    amount: number;
    description: string | null;
    product_name: string | null;
    duration: string | null;
    purchase_date: string | null;
    created_at: string;
}

export interface LeadDetailDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    chatId: string | null;
}
