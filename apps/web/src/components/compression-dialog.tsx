"use client";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { File, Loader2 } from "lucide-react";
import { formatFileSize } from "@/lib/file-service";
import { CompressionEstimate } from "@/lib/compression-service";

interface CompressionDialogProps {
  open: boolean;
  pendingFile: File | null;
  compressionEstimate: CompressionEstimate | null;
  imageQuality: number;
  compressing: boolean;
  compressionProgress: number;
  onQualityChange: (quality: number) => void;
  onCompress: () => void;
  onCancel: () => void;
}

export const CompressionDialog = ({
  open,
  pendingFile,
  compressionEstimate,
  imageQuality,
  compressing,
  compressionProgress,
  onQualityChange,
  onCompress,
  onCancel,
}: CompressionDialogProps) => {
  if (!pendingFile || !compressionEstimate) return null;

  const reductionPercent = (
    ((compressionEstimate.originalSize - compressionEstimate.estimatedSize) /
      compressionEstimate.originalSize) *
    100
  ).toFixed(1);

  const estimateExceedsLimit = compressionEstimate.estimatedSize > 500 * 1024;
  const isImage = pendingFile.type.startsWith("image/");
  const isPdf = pendingFile.type === "application/pdf";

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onCancel(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <File className="h-5 w-5" />
            Compress File
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
            <p className="text-sm font-medium truncate" title={pendingFile.name}>
              {pendingFile.name}
            </p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Original</p>
                <p className="font-medium">{formatFileSize(compressionEstimate.originalSize)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Estimated</p>
                <p className="font-medium text-primary">
                  {formatFileSize(compressionEstimate.estimatedSize)}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-2">
              <span>Reduction</span>
              <span className="font-medium">{reductionPercent}%</span>
            </div>
          </div>

          {isImage && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Quality</label>
                <span className="text-sm text-muted-foreground">
                  {Math.round(imageQuality * 100)}%
                </span>
              </div>
              <Slider
                value={[imageQuality]}
                onValueChange={(val) => onQualityChange(val[0])}
                min={0.5}
                max={0.95}
                step={0.05}
                disabled={compressing}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Smaller file</span>
                <span>Higher quality</span>
              </div>
            </div>
          )}

          {isPdf && (
            <div className="rounded-md border border-yellow-500/30 bg-yellow-500/10 p-3 text-xs text-yellow-700 dark:text-yellow-400">
              PDF compression has limited effectiveness. The file may not compress significantly.
            </div>
          )}

          {estimateExceedsLimit && (
            <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-700 dark:text-red-400">
              Estimated size ({formatFileSize(compressionEstimate.estimatedSize)}) may still exceed the 500KB limit.
            </div>
          )}

          {compressing && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Compressing...</span>
                <span className="tabular-nums">{compressionProgress}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${compressionProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={compressing}>
            Cancel
          </Button>
          <Button
            onClick={onCompress}
            disabled={compressing || !compressionEstimate.canCompress}
          >
            {compressing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Compressing...
              </>
            ) : (
              "Compress & Upload"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
