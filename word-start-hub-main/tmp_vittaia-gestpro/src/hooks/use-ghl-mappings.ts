import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";

export type GhlSyncMapping = {
    id: string;
    organization_id: string;
    resource_type: "contact" | "pipeline" | "stage" | "tag" | "opportunity";
    vitta_id: string;
    ghl_id: string;
    last_synced_at: string;
};

export function useGhlMappings() {
    const { currentOrganization } = useOrganization();
    const orgId = currentOrganization?.id;

    const { data: mappings = [], isLoading, refetch } = useQuery({
        queryKey: ["ghl-mappings", orgId],
        queryFn: async () => {
            if (!orgId) return [];
            const { data, error } = await supabase
                .from("ghl_sync_mappings")
                .select("*")
                .eq("organization_id", orgId);

            if (error) throw error;
            return data as GhlSyncMapping[];
        },
        enabled: !!orgId,
        staleTime: 1000 * 60 * 5, // 5 minutes
    });

    const isMapped = (vittaId: string, resourceType?: GhlSyncMapping["resource_type"]) => {
        return mappings.some(
            (m) => m.vitta_id === vittaId && (!resourceType || m.resource_type === resourceType)
        );
    };

    const getGhlId = (vittaId: string, resourceType?: GhlSyncMapping["resource_type"]) => {
        return mappings.find(
            (m) => m.vitta_id === vittaId && (!resourceType || m.resource_type === resourceType)
        )?.ghl_id;
    };

    return {
        mappings,
        isLoading,
        isMapped,
        getGhlId,
        refetch,
    };
}
