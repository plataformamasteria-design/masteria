import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Layers, Plus } from 'lucide-react';

export function ChatFunnelBadge({ chatId, onClick }: { chatId: string, onClick?: (e: React.MouseEvent) => void }) {
    const [data, setData] = useState<Array<{ id: string, funnelName: string, stageName: string, stageColor: string }>>([]);

    useEffect(() => {
        let isMounted = true;

        async function fetchInfo() {
            try {
                const { data: cfsData } = await supabase
                    .from('chat_funnel_stage')
                    .select('funnel_id, stage_id')
                    .eq('chat_id', chatId);

                if (cfsData && cfsData.length > 0 && isMounted) {
                    const fIds = Array.from(new Set(cfsData.map(c => c.funnel_id).filter(Boolean)));
                    const sIds = Array.from(new Set(cfsData.map(c => c.stage_id).filter(Boolean)));

                    if (fIds.length === 0 || sIds.length === 0) {
                        if (isMounted) setData([]);
                        return;
                    }

                    const [fData, sData] = await Promise.all([
                        supabase.from('funnels').select('id, name').in('id', fIds),
                        supabase.from('funnel_stages').select('id, name, color').in('id', sIds)
                    ]);

                    if (fData.data && sData.data && isMounted) {
                        const formatted = cfsData.map((cfs, idx) => {
                            const funnel = fData.data.find(f => f.id === cfs.funnel_id);
                            const stage = sData.data.find(s => s.id === cfs.stage_id);
                            if (funnel && stage) {
                                return {
                                    id: `${cfs.funnel_id}-${cfs.stage_id}-${idx}`,
                                    funnelName: funnel.name,
                                    stageName: stage.name,
                                    stageColor: stage.color || 'currentColor'
                                };
                            }
                            return null;
                        }).filter(Boolean);

                        setData(formatted as any);
                    } else if (isMounted) {
                        setData([]);
                    }
                } else if (isMounted) {
                    setData([]);
                }
            } catch (err) {
                console.error("Erro ao buscar funnel stage:", err);
            }
        }

        const channel = supabase.channel(`cfs-${chatId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_funnel_stage', filter: `chat_id=eq.${chatId}` }, () => {
                fetchInfo();
            })
            .subscribe();

        fetchInfo();

        return () => {
            isMounted = false;
            supabase.removeChannel(channel);
        }
    }, [chatId]);

    const handleClick = (e: React.MouseEvent) => {
        if (onClick) {
            e.stopPropagation();
            onClick(e);
        }
    };

    if (!data || data.length === 0) {
        return (
            <div onClick={handleClick} className="flex shrink-0">
                <Badge variant="outline" className="px-2 py-0 h-6 text-[10px] gap-1 shrink-0 whitespace-nowrap bg-background/50 border-dashed text-muted-foreground hover:bg-muted/50 cursor-pointer transition-colors">
                    <Plus className="h-3 w-3" />
                    Funil
                </Badge>
            </div>
        );
    }

    return (
        <div className="flex flex-nowrap gap-1.5 items-center cursor-pointer hover:opacity-80 transition-opacity" onClick={handleClick}>
            {data.slice(0, 1).map(d => (
                <Badge
                    key={d.id}
                    variant="outline"
                    className="px-2 py-0 h-6 text-[10px] gap-1.5 shrink-0 whitespace-nowrap bg-background/50 backdrop-blur-sm transition-colors border-opacity-50"
                    style={{
                        borderColor: d.stageColor,
                        color: d.stageColor,
                        backgroundColor: `${d.stageColor}10`
                    }}
                >
                    <Layers className="h-3 w-3 shrink-0 opacity-80" />
                    <span className="truncate max-w-[150px] font-medium">{d.funnelName} › {d.stageName}</span>
                </Badge>
            ))}
        </div>
    );
}
