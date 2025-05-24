import type { FileType } from "@/lib/types";
import { File, FileArchive, FileAudio, FileImage, FileText, FileVideo, HelpCircle } from "lucide-react";

interface FileIconProps {
  type: FileType;
  className?: string;
}

export function FileIcon({ type, className = "h-5 w-5" }: FileIconProps) {
  switch (type) {
    case "image":
      return <FileImage className={className} />;
    case "video":
      return <FileVideo className={className} />;
    case "audio":
      return <FileAudio className={className} />;
    case "document":
      return <FileText className={className} />;
    case "archive":
      return <FileArchive className={className} />;
    case "other":
      return <File className={className} />;
    default:
      return <HelpCircle className={className} />;
  }
}
