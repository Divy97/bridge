"use client";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { Download, File, Shield, X } from "lucide-react";
import { isImageType, formatFileSize } from "@/lib/file-service";
import { FileAttachmentData } from "@/lib/firebase-service";
import { Timestamp } from "firebase/firestore";

interface FileSectionProps {
  files: FileAttachmentData[];
  onFileDownload: (file: FileAttachmentData) => void;
  onFileDelete: (fileId: string, fileName: string, storageType?: "storage" | "base64") => void;
  isFileExpired: (expiresAt: Timestamp) => boolean;
}

export const FileSection = ({
  files,
  onFileDownload,
  onFileDelete,
  isFileExpired,
}: FileSectionProps) => {
  if (!files || files.length === 0) return null;

  return (
    <div className="border-b p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <File className="h-4 w-4" />
          Attached File
        </h3>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-default">
              <Shield className="h-3 w-3" />
              <span>Auto-deletes in 30 min</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="left" className="max-w-[240px]">
            Files are automatically deleted after 30 minutes for your privacy. Max file size: 500KB.
          </TooltipContent>
        </Tooltip>
      </div>

      <div className="space-y-3">
        {files.map((file) => {
          const expired = isFileExpired(file.expiresAt);

          return (
            <div
              key={file.id}
              className={`relative rounded-lg border bg-muted/20 overflow-hidden ${
                expired ? "opacity-50" : ""
              }`}
            >
              {isImageType(file.type) ? (
                <div className="space-y-0">
                  <div className="relative group">
                    <img
                      src={file.url}
                      alt={file.name}
                      className="w-full h-48 object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/0 opacity-0 transition-all group-hover:bg-black/40 group-hover:opacity-100">
                      <Button
                        variant="secondary"
                        size="icon"
                        className="h-9 w-9 rounded-full shadow-lg"
                        onClick={() => onFileDownload(file)}
                        title="Download"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon"
                        className="h-9 w-9 rounded-full shadow-lg"
                        onClick={() => onFileDelete(file.id, file.name, file.storageType)}
                        title="Remove"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-xs text-muted-foreground truncate flex-1" title={file.name}>
                      {file.name}
                    </span>
                    <span className="text-xs text-muted-foreground ml-2 tabular-nums">
                      {formatFileSize(file.size)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-muted">
                      <File className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{file.name}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {file.originalSize && file.originalSize > file.size ? (
                          <>
                            {formatFileSize(file.size)}{" "}
                            <span className="text-muted-foreground/60">
                              (was {formatFileSize(file.originalSize)})
                            </span>
                          </>
                        ) : (
                          formatFileSize(file.size)
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => onFileDownload(file)}
                      title={file.type === "application/pdf" ? "Open PDF" : "Download file"}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => onFileDelete(file.id, file.name, file.storageType)}
                      title="Remove file"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
              {expired && (
                <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/60">
                  <span className="text-xs text-muted-foreground font-medium">Expired</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
