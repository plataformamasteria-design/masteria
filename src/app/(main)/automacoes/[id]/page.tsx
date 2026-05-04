"use client";

import { AutomationFlowEditor } from "@/components/automations/AutomationFlowEditor";

export default function AutomationEditorPage() {
    return (
        <div className="w-full h-[calc(100vh-4rem)] flex flex-col">
            <AutomationFlowEditor />
        </div>
    );
}
