import { useState, useRef } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface SearchableSelectorProps {
  label: string;
  placeholder: string;
  items: { id: string; name: string; subtitle?: string; avatar_url?: string }[];
  value: string;
  onChange: (value: string) => void;
  emptyMessage?: string;
}

export function SearchableSelector({
  label,
  placeholder,
  items,
  value,
  onChange,
  emptyMessage = "Nenhum item encontrado",
}: SearchableSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const blurTimeout = useRef<ReturnType<typeof setTimeout>>();

  const filteredItems = items.filter((item) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      item.name.toLowerCase().includes(searchLower) ||
      item.subtitle?.toLowerCase().includes(searchLower)
    );
  });

  const displayItems = searchQuery ? filteredItems : filteredItems.slice(0, 10);
  const selectedItem = items.find((item) => item.id === value);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange("")}
            className="h-6 px-2"
          >
            <X className="h-3 w-3 mr-1" />
            Limpar
          </Button>
        )}
      </div>

      {selectedItem && (
        <div className="p-3 rounded-lg border bg-muted/50 flex items-center gap-3">
          {selectedItem.avatar_url && (
            <Avatar className="h-8 w-8">
              <AvatarImage src={selectedItem.avatar_url} alt={selectedItem.name} />
              <AvatarFallback className="text-xs">
                {selectedItem.name[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
          )}
          <div className="flex-1 min-w-0">
            <div className="font-medium">{selectedItem.name}</div>
            {selectedItem.subtitle && (
              <div className="text-sm text-muted-foreground">{selectedItem.subtitle}</div>
            )}
          </div>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder={placeholder}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => {
            clearTimeout(blurTimeout.current);
            setIsFocused(true);
          }}
          onBlur={() => {
            blurTimeout.current = setTimeout(() => setIsFocused(false), 200);
          }}
          className="pl-9"
        />
      </div>

      {isFocused && (
        <>
          <ScrollArea className="h-[200px] rounded-lg border">
            <RadioGroup value={value} onValueChange={(val) => { onChange(val); setIsFocused(false); }} className="p-2">
              {displayItems.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  {emptyMessage}
                </div>
              ) : (
                displayItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start space-x-3 p-3 rounded-lg hover:bg-accent cursor-pointer"
                  >
                    <RadioGroupItem value={item.id} id={item.id} />
                    {item.avatar_url && (
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={item.avatar_url} alt={item.name} />
                        <AvatarFallback className="text-xs">
                          {item.name[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <label
                      htmlFor={item.id}
                      className="flex-1 cursor-pointer space-y-1"
                    >
                      <div className="font-medium leading-none">{item.name}</div>
                      {item.subtitle && (
                        <div className="text-sm text-muted-foreground">
                          {item.subtitle}
                        </div>
                      )}
                    </label>
                  </div>
                ))
              )}
            </RadioGroup>
          </ScrollArea>

          {!searchQuery && filteredItems.length > 10 && (
            <p className="text-xs text-muted-foreground text-center">
              Mostrando 10 de {filteredItems.length} itens. Use a busca para ver mais.
            </p>
          )}
        </>
      )}
    </div>
  );
}
