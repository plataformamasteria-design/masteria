import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Instagram, Facebook } from "lucide-react";
import { SocialInsightsTab } from "./MarketingComponents";
import type { SocialProfile } from "./MarketingComponents";

export function UnifiedSocialTab({ profiles }: { profiles: SocialProfile[] }) {
    const igProfile = profiles.find(p => p.platform === 'instagram');
    const fbProfile = profiles.find(p => p.platform === 'facebook');

    return (
        <div className="mt-4 animate-in fade-in zoom-in-95 duration-500">
            <Tabs defaultValue={igProfile ? "instagram" : "facebook"} className="w-full">
                <div className="flex items-center justify-center mb-6">
                    <TabsList className="grid w-full max-w-sm grid-cols-2">
                        <TabsTrigger value="instagram" className="gap-2">
                            <Instagram className="w-4 h-4" /> Instagram
                        </TabsTrigger>
                        <TabsTrigger value="facebook" className="gap-2">
                            <Facebook className="w-4 h-4" /> Facebook
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="instagram" className="mt-0">
                    <SocialInsightsTab profile={igProfile} icon={Instagram} label="Instagram" />
                </TabsContent>
                <TabsContent value="facebook" className="mt-0">
                    <SocialInsightsTab profile={fbProfile} icon={Facebook} label="Facebook" />
                </TabsContent>
            </Tabs>
        </div>
    );
}
