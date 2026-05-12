import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const PRESET_COLORS = [
  "#EF4444", // red
  "#F97316", // orange
  "#F59E0B", // amber
  "#10B981", // emerald
  "#3B82F6", // blue
  "#8B5CF6", // violet
  "#EC4899", // pink
  "#6B7280", // gray
  "#14B8A6", // teal
  "#A855F7", // purple
  "#F43F5E", // rose
  "#84CC16", // lime
];

interface CompactColorPickerProps {
  value: string;
  onChange: (color: string) => void;
}

const CompactColorPicker = ({ value, onChange }: CompactColorPickerProps) => {
  const [customColor, setCustomColor] = useState(value);

  const handleCustomColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newColor = e.target.value;
    setCustomColor(newColor);
    if (/^#[0-9A-F]{6}$/i.test(newColor)) {
      onChange(newColor);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-sm font-medium mb-2 block">Cores Predefinidas</Label>
        <div className="grid grid-cols-6 gap-2">
          {PRESET_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => {
                onChange(color);
                setCustomColor(color);
              }}
              className="w-10 h-10 rounded-md border-2 transition-all hover:scale-110"
              style={{
                backgroundColor: color,
                borderColor: value === color ? "#000" : "transparent",
              }}
              title={color}
            />
          ))}
        </div>
      </div>
      
      <div>
        <Label htmlFor="custom-color" className="text-sm font-medium mb-2 block">
          Cor Personalizada (Hex)
        </Label>
        <div className="flex gap-2 items-center">
          <Input
            id="custom-color"
            type="text"
            value={customColor}
            onChange={handleCustomColorChange}
            placeholder="#FF5733"
            maxLength={7}
            className="font-mono"
          />
          <div
            className="w-10 h-10 rounded-md border flex-shrink-0"
            style={{ backgroundColor: customColor }}
          />
        </div>
      </div>
    </div>
  );
};

export default CompactColorPicker;
