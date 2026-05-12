import { useState, useEffect } from "react";
import { supabase as supabaseOriginal } from "@/integrations/supabase/client";
const supabase = supabaseOriginal as any;
import { useOrganization } from "@/contexts/OrganizationContext";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Plus } from "lucide-react";

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface TagPickerProps {
  chatId: string;
  assignedTags: string[];
  onTagsChange: () => void;
}

const TagPicker = ({ chatId, assignedTags, onTagsChange }: TagPickerProps) => {
  const [tags, setTags] = useState<Tag[]>([]);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const { currentOrganization } = useOrganization();

  useEffect(() => {
    fetchTags();
  }, [currentOrganization?.id]);

  const fetchTags = async () => {
    if (!currentOrganization?.id) return;
    const { data, error } = await supabase
      .from("tags")
      .select("*")
      .eq("organization_id", currentOrganization.id)
      .order("order_position", { ascending: true });

    if (error) {
      console.error("Error fetching tags:", error);
      return;
    }

    setTags(data || []);
  };

  const handleToggleTag = async (tagId: string, isAssigned: boolean) => {
    if (isAssigned) {
      // Remove tag
      const { error } = await supabase
        .from("chat_tags")
        .delete()
        .eq("chat_id", chatId)
        .eq("tag_id", tagId);

      if (error) {
        toast({
          title: "Erro ao remover tag",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      // Trigger follow-up tag removal detector
      try {
        await supabase.functions.invoke('follow-up-tag-removed', {
          body: { chat_id: chatId, tag_id: tagId }
        });
      } catch (error) {
        console.error('Error triggering follow-up tag removal:', error);
      }
    } else {
      // Add tag
      if (!currentOrganization?.id) return;
      
      const { error } = await supabase.from("chat_tags").insert({
        chat_id: chatId,
        tag_id: tagId,
        organization_id: currentOrganization.id,
      });

      if (error) {
        toast({
          title: "Erro ao adicionar tag",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      // Trigger follow-up detector
      try {
        await supabase.functions.invoke('follow-up-trigger-detector', {
          body: { chat_id: chatId, tag_id: tagId }
        });
      } catch (error) {
        console.error('Error triggering follow-up detector:', error);
      }
    }

    onTagsChange();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <Plus className="h-3 w-3" />
          Tag
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64" align="end">
        <div className="space-y-2">
          <h4 className="font-semibold text-sm mb-3">Selecionar Tags</h4>
          {tags.map((tag) => {
            const isAssigned = assignedTags.includes(tag.id);
            return (
              <div key={tag.id} className="flex items-center gap-2">
                <Checkbox
                  id={`tag-${tag.id}`}
                  checked={isAssigned}
                  onCheckedChange={() => handleToggleTag(tag.id, isAssigned)}
                />
                <label
                  htmlFor={`tag-${tag.id}`}
                  className="flex items-center gap-2 cursor-pointer flex-1"
                >
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="text-sm">{tag.name}</span>
                </label>
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default TagPicker;
