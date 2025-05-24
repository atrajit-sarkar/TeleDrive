"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { UploadFormData } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { UploadCloud } from "lucide-react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

interface UploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpload: (data: UploadFormData) => void; // Callback after successful upload
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "video/mp4", "audio/mpeg", "application/pdf", "application/zip"];


const uploadSchema = z.object({
  file: z.custom<FileList>()
    .refine((files) => files?.length > 0, "File is required.")
    .refine((files) => files?.[0]?.size <= MAX_FILE_SIZE, `Max file size is 5MB.`)
    .refine(
      (files) => ACCEPTED_IMAGE_TYPES.includes(files?.[0]?.type),
      "Only .jpg, .jpeg, .png, .webp, .mp4, .mp3, .pdf, .zip files are accepted."
    ),
  fileName: z.string().min(1, "File name is required").max(100, "File name too long"),
  tags: z.string().optional(),
});


export function UploadDialog({ open, onOpenChange, onUpload }: UploadDialogProps) {
  const { toast } = useToast();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<UploadFormData>({
    resolver: zodResolver(uploadSchema),
  });

  const onSubmit: SubmitHandler<UploadFormData> = (data) => {
    // In a real app, this would involve actual file upload logic
    console.log("Upload data:", data);
    onUpload(data);
    toast({
      title: "File Uploaded (Mock)",
      description: `${data.fileName} has been successfully queued for upload.`,
      variant: "default"
    });
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px] shadow-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <UploadCloud className="h-6 w-6 text-primary" /> Upload Media
          </DialogTitle>
          <DialogDescription>
            Upload files to your Telegram Saved Messages. Add a name and tags for easy organization.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-6 py-4">
          <div className="grid gap-2">
            <Label htmlFor="file-upload">File</Label>
            <Input id="file-upload" type="file" {...register("file")} className="file:text-primary file:font-semibold hover:file:bg-primary/10"/>
            {errors.file && <p className="text-sm text-destructive">{errors.file.message}</p>}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="fileName">File Name</Label>
            <Input id="fileName" placeholder="e.g., Summer Vacation Album" {...register("fileName")} />
            {errors.fileName && <p className="text-sm text-destructive">{errors.fileName.message}</p>}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="tags">Tags (comma-separated)</Label>
            <Textarea id="tags" placeholder="e.g., holiday, beach, 2024" {...register("tags")} />
             {errors.tags && <p className="text-sm text-destructive">{errors.tags.message}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" className="bg-accent hover:bg-accent/90 text-accent-foreground">
              <UploadCloud className="mr-2 h-4 w-4" /> Upload
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
