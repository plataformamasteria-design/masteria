import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Paperclip, User, MapPin, QrCode, FileText, Video, ImageIcon } from "lucide-react";
import { SendContactDialog } from "./SendContactDialog";
import { SendLocationDialog } from "./SendLocationDialog";
import { SendPixDialog } from "./SendPixDialog";
import { SendVideoDialog } from "./SendVideoDialog";
import { SendImageDialog } from "./SendImageDialog";

interface AttachmentMenuProps {
  chatId: string;
  onDocumentPick: () => void;
}

export const AttachmentMenu: React.FC<AttachmentMenuProps> = ({ chatId, onDocumentPick }) => {
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);
  const [pixDialogOpen, setPixDialogOpen] = useState(false);
  const [videoDialogOpen, setVideoDialogOpen] = useState(false);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            <Paperclip className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48 bg-popover border shadow-lg z-50">
          <DropdownMenuItem 
            onClick={() => setImageDialogOpen(true)}
            className="flex items-center gap-2 cursor-pointer"
          >
            <ImageIcon className="h-4 w-4 text-green-500" />
            <span>Imagem</span>
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => setVideoDialogOpen(true)}
            className="flex items-center gap-2 cursor-pointer"
          >
            <Video className="h-4 w-4 text-purple-500" />
            <span>Vídeo</span>
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={onDocumentPick}
            className="flex items-center gap-2 cursor-pointer"
          >
            <FileText className="h-4 w-4 text-orange-500" />
            <span>Documento</span>
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => setContactDialogOpen(true)}
            className="flex items-center gap-2 cursor-pointer"
          >
            <User className="h-4 w-4 text-blue-500" />
            <span>Contato</span>
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => setLocationDialogOpen(true)}
            className="flex items-center gap-2 cursor-pointer"
          >
            <MapPin className="h-4 w-4 text-green-500" />
            <span>Localização</span>
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => setPixDialogOpen(true)}
            className="flex items-center gap-2 cursor-pointer"
          >
            <QrCode className="h-4 w-4 text-teal-500" />
            <span>PIX</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <SendImageDialog
        open={imageDialogOpen}
        onOpenChange={setImageDialogOpen}
        chatId={chatId}
      />
      <SendContactDialog 
        open={contactDialogOpen} 
        onOpenChange={setContactDialogOpen} 
        chatId={chatId} 
      />
      <SendLocationDialog 
        open={locationDialogOpen} 
        onOpenChange={setLocationDialogOpen} 
        chatId={chatId} 
      />
      <SendPixDialog 
        open={pixDialogOpen} 
        onOpenChange={setPixDialogOpen} 
        chatId={chatId} 
      />
      <SendVideoDialog 
        open={videoDialogOpen} 
        onOpenChange={setVideoDialogOpen} 
        chatId={chatId} 
      />
    </>
  );
};
