"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  getRoom,
  streamRoom,
  updateRoomText,
  addFileToRoom,
  removeFileFromRoom,
  Room,
  FileAttachmentData,
} from "@/lib/firebase-service";
import {
  uploadFile,
  fileAttachmentToFirestore,
  formatFileSize,
  deleteFile,
} from "@/lib/file-service";
import {
  shouldOfferCompression,
  getCompressionEstimate,
  compressFile,
  CompressionEstimate,
} from "@/lib/compression-service";
import { useDebouncedCallback } from "use-debounce";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  Loader2,
  Home,
  Copy,
  Share2,
  Download,
  Sun,
  Moon,
  Upload,
  Check,
  CloudOff,
  ArrowLeft,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Timestamp } from "firebase/firestore";
import { CompressionDialog } from "@/components/compression-dialog";
import { FileSection } from "@/components/file-section";

export default function RoomPage() {
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showCompressionDialog, setShowCompressionDialog] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [compressionEstimate, setCompressionEstimate] = useState<CompressionEstimate | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState(0);
  const [imageQuality, setImageQuality] = useState(0.8);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [isDragOver, setIsDragOver] = useState(false);

  const dragCounter = useRef(0);
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const params = useParams();
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  const roomCode = (params.roomCode as string)?.toUpperCase();

  const charCount = room?.text?.length || 0;
  const wordCount = room?.text?.trim() ? room.text.trim().split(/\s+/).length : 0;

  const debouncedUpdate = useDebouncedCallback(async (newText: string) => {
    if (!roomCode) return;
    setSaveStatus("saving");
    try {
      await updateRoomText(roomCode, newText);
      setSaveStatus("saved");
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (err) {
      console.error("Error updating room text:", err);
      setSaveStatus("idle");
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      if (errorMessage.includes("encryption") || errorMessage.includes("ENCRYPTION_KEY")) {
        toast.error("Encryption Error", {
          description: "Failed to encrypt text. Please check configuration.",
        });
      } else {
        toast.error("Failed to save", {
          description: "Could not update room text. Please try again.",
        });
      }
    }
  }, 300);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setRoom((prevRoom) => (prevRoom ? { ...prevRoom, text: newText } : null));
    debouncedUpdate(newText);
  };

  useEffect(() => {
    if (!roomCode) return;
    const fetchRoom = async () => {
      try {
        const roomData = await getRoom(roomCode);
        if (roomData) {
          setRoom(roomData);
        } else {
          setError("Room not found.");
          toast.error("This room code does not exist.");
          setTimeout(() => router.push("/"), 2000);
        }
      } catch (err) {
        console.error("Error fetching room:", err);
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        if (errorMessage.includes("encryption") || errorMessage.includes("ENCRYPTION_KEY")) {
          setError("Encryption configuration error. Please check environment variables.");
          toast.error("Encryption Error", {
            description: "Failed to decrypt room data. Please contact support.",
          });
        } else {
          setError("Failed to load room.");
          toast.error("Failed to load room", { description: errorMessage });
        }
      } finally {
        setLoading(false);
      }
    };
    fetchRoom();
  }, [roomCode, router]);

  useEffect(() => {
    if (loading || error || !roomCode) return;
    const unsubscribe = streamRoom(roomCode, (liveRoomData) => {
      setRoom(liveRoomData);
      setIsConnected(true);
    });
    return () => {
      unsubscribe();
      setIsConnected(false);
    };
  }, [roomCode, loading, error]);

  const copyText = () => {
    if (room?.text) {
      navigator.clipboard.writeText(room.text);
      toast.success("Text copied!");
    }
  };

  const downloadText = () => {
    if (room?.text) {
      const blob = new Blob([room.text], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bridge-${roomCode}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Text downloaded!");
    }
  };

  const shareRoom = async () => {
    const roomUrl = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Bridge Room ${roomCode}`,
          url: roomUrl,
        });
      } else {
        throw new Error("Web Share API not supported");
      }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_error) {
      await navigator.clipboard.writeText(roomUrl);
      toast.success("Room URL copied to clipboard!");
    }
  };

  const processFile = useCallback(async (file: File) => {
    if (!roomCode) return;

    if (room?.files && room.files.length > 0) {
      toast.error("File already attached", {
        description: "Only 1 file is allowed per room. Please remove the existing file first.",
      });
      return;
    }

    const MAX_SIZE = 500 * 1024;
    if (file.size > MAX_SIZE) {
      if (shouldOfferCompression(file)) {
        setUploading(true);
        try {
          const estimate = await getCompressionEstimate(file, imageQuality);
          setPendingFile(file);
          setCompressionEstimate(estimate);
          setShowCompressionDialog(true);
        } catch (err) {
          console.error("Error getting compression estimate:", err);
          toast.error("Could not estimate compression", {
            description: "Please try a smaller file.",
            duration: 5000,
          });
        } finally {
          setUploading(false);
        }
        return;
      }
      toast.error("File too large", {
        description: `Only files under 500KB are allowed. Your file is ${formatFileSize(file.size)}.`,
        duration: 5000,
      });
      return;
    }

    await uploadFileDirectly(file);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, room?.files, imageQuality]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
    e.target.value = "";
  };

  const uploadFileDirectly = async (file: File) => {
    if (!roomCode) return;
    setUploading(true);
    try {
      const attachment = await uploadFile(file, roomCode, true);
      const fileData = fileAttachmentToFirestore(attachment);
      await addFileToRoom(roomCode, fileData);
      toast.success("File uploaded!", {
        description: `${file.name} (${formatFileSize(file.size)}) - auto-deletes in 30 minutes.`,
      });
    } catch (err) {
      console.error("Error uploading file:", err);
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      if (errorMessage.includes("500KB") || errorMessage.includes("size")) {
        toast.error("File size limit exceeded", { description: errorMessage, duration: 5000 });
      } else if (errorMessage.includes("not supported") || errorMessage.includes("type")) {
        toast.error("File type not supported", { description: errorMessage, duration: 5000 });
      } else {
        toast.error("Upload failed", { description: errorMessage, duration: 5000 });
      }
    } finally {
      setUploading(false);
    }
  };

  const handleCompressAndUpload = async () => {
    if (!pendingFile || !roomCode || !compressionEstimate) return;
    setCompressing(true);
    setCompressionProgress(0);
    try {
      const quality = pendingFile.type.startsWith("image/") ? imageQuality : undefined;
      const result = await compressFile(pendingFile, 500, quality, (progress) => {
        setCompressionProgress(progress);
      });
      if (result.compressedSize > 500 * 1024) {
        toast.error("Compression insufficient", {
          description: `Compressed file is still ${formatFileSize(result.compressedSize)} (limit: 500KB).`,
          duration: 6000,
        });
        setCompressing(false);
        setCompressionProgress(0);
        return;
      }
      if (result.compressedSize >= result.originalSize) {
        toast.error("Compression didn't reduce size", {
          description: `Original size: ${formatFileSize(result.originalSize)}.`,
          duration: 5000,
        });
        setCompressing(false);
        setCompressionProgress(0);
        return;
      }
      const attachment = await uploadFile(result.compressedFile, roomCode, true);
      attachment.originalSize = result.originalSize;
      attachment.wasCompressed = true;
      const fileData = fileAttachmentToFirestore(attachment);
      await addFileToRoom(roomCode, fileData);
      toast.success("File compressed and uploaded!", {
        description: `Reduced by ${result.compressionRatio.toFixed(1)}% (${formatFileSize(result.originalSize)} → ${formatFileSize(result.compressedSize)})`,
        duration: 5000,
      });
      setShowCompressionDialog(false);
      setPendingFile(null);
      setCompressionEstimate(null);
      setCompressionProgress(0);
    } catch (err) {
      console.error("Error compressing file:", err);
      toast.error("Compression failed", {
        description: "Please try again or use a different file.",
        duration: 5000,
      });
    } finally {
      setCompressing(false);
      setCompressionProgress(0);
    }
  };

  const handleCancelCompression = () => {
    setShowCompressionDialog(false);
    setPendingFile(null);
    setCompressionEstimate(null);
    setCompressionProgress(0);
  };

  const handleQualityChange = async (quality: number) => {
    setImageQuality(quality);
    if (pendingFile) {
      try {
        const newEstimate = await getCompressionEstimate(pendingFile, quality);
        setCompressionEstimate(newEstimate);
      } catch (err) {
        console.error("Error recalculating estimate:", err);
      }
    }
  };

  const handleFileDelete = async (
    fileId: string,
    fileName: string,
    storageType?: "storage" | "base64"
  ) => {
    if (!roomCode) return;
    try {
      await removeFileFromRoom(roomCode, fileId);
      await deleteFile(roomCode, fileId, fileName, storageType);
      toast.success("File removed", { description: `${fileName} has been removed.` });
    } catch (err) {
      console.error("Error deleting file:", err);
      toast.error("Failed to remove file", { description: "Please try again.", duration: 3000 });
    }
  };

  const isFileExpired = (expiresAt: Timestamp): boolean => {
    if (!expiresAt) return false;
    return expiresAt.toDate() < new Date();
  };

  const handleFileDownload = async (file: FileAttachmentData) => {
    try {
      if (file.url.startsWith("data:")) {
        const response = await fetch(file.url);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        if (file.type === "application/pdf") {
          const newWindow = window.open(blobUrl, "_blank");
          if (newWindow) {
            newWindow.addEventListener("beforeunload", () => URL.revokeObjectURL(blobUrl));
            setTimeout(() => URL.revokeObjectURL(blobUrl), 5 * 60 * 1000);
          } else {
            const a = document.createElement("a");
            a.href = blobUrl;
            a.download = file.name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
          }
        } else {
          const a = document.createElement("a");
          a.href = blobUrl;
          a.download = file.name;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
        }
      } else {
        if (file.type === "application/pdf") {
          const newWindow = window.open(file.url, "_blank");
          if (!newWindow) {
            const a = document.createElement("a");
            a.href = file.url;
            a.download = file.name;
            a.target = "_blank";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          }
        } else {
          const a = document.createElement("a");
          a.href = file.url;
          a.download = file.name;
          a.target = "_blank";
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
      }
    } catch (err) {
      console.error("Error downloading file:", err);
      toast.error("Failed to open file", { description: "Please try again." });
    }
  };

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragOver(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await processFile(file);
    }
  }, [processFile]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background bg-dot-grid p-4">
        <div className="w-full max-w-3xl animate-fade-in">
          <div className="rounded-xl border bg-card/50 backdrop-blur-sm shadow-xl overflow-hidden">
            <div className="border-b p-5">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <div className="skeleton h-7 w-32 rounded" />
                  <div className="skeleton h-4 w-20 rounded" />
                </div>
                <div className="flex gap-2">
                  <div className="skeleton h-9 w-9 rounded-lg" />
                  <div className="skeleton h-9 w-9 rounded-lg" />
                  <div className="skeleton h-9 w-9 rounded-lg" />
                </div>
              </div>
            </div>
            <div className="p-6">
              <div className="skeleton h-64 w-full rounded-lg" />
            </div>
            <div className="border-t p-4">
              <div className="flex items-center justify-between">
                <div className="skeleton h-4 w-40 rounded" />
                <div className="flex gap-2">
                  <div className="skeleton h-9 w-28 rounded-lg" />
                  <div className="skeleton h-9 w-24 rounded-lg" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background bg-dot-grid p-4">
        <div className="w-full max-w-sm text-center space-y-6 animate-fade-in">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <CloudOff className="h-8 w-8 text-destructive" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold">{error}</h1>
            <p className="text-sm text-muted-foreground">
              The room you&apos;re looking for doesn&apos;t exist or has been removed.
            </p>
          </div>
          <Button onClick={() => router.push("/")} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Go Home
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="h-screen bg-background bg-dot-grid flex flex-col overflow-hidden">
      <div className="flex w-full max-w-4xl flex-col h-full mx-auto sm:my-4 sm:rounded-xl border bg-card/50 backdrop-blur-sm shadow-xl overflow-hidden animate-fade-in">
        <div className="border-b px-4 py-3 sm:px-5 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="font-mono text-xl sm:text-2xl font-bold tracking-widest text-primary">
                {roomCode}
              </h1>
              <Badge
                variant={isConnected ? "default" : "secondary"}
                className="gap-1.5 text-[10px] font-normal px-2 py-0.5"
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    isConnected ? "bg-green-400 animate-pulse-dot" : "bg-yellow-400"
                  }`}
                />
                {isConnected ? "Live" : "Connecting"}
              </Badge>
              {saveStatus === "saving" && (
                <span className="text-xs text-muted-foreground animate-fade-in">
                  Saving...
                </span>
              )}
              {saveStatus === "saved" && (
                <span className="text-xs text-green-500 flex items-center gap-1 animate-fade-in">
                  <Check className="h-3 w-3" />
                  Saved
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={shareRoom} variant="ghost" size="icon" className="h-9 w-9">
                    <Share2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Share room</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  >
                    <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                    <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Toggle theme</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() => router.push("/")}
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                  >
                    <Home className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Go home</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>

        <div className="flex flex-1 flex-col min-h-0">
          <FileSection
            files={room?.files || []}
            onFileDownload={handleFileDownload}
            onFileDelete={handleFileDelete}
            isFileExpired={isFileExpired}
          />

          <div
            className="relative flex-1 flex flex-col min-h-0"
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <Textarea
              value={room?.text || ""}
              onChange={handleTextChange}
              placeholder="Start typing to share..."
              className="h-full w-full flex-1 resize-none border-0 bg-transparent p-4 sm:p-6 font-mono text-sm sm:text-base focus-visible:ring-0 overflow-y-auto"
            />
            {isDragOver && (
              <div className="absolute inset-0 z-10 flex items-center justify-center drop-zone-active m-2 rounded-lg">
                <div className="text-center space-y-2">
                  <Upload className="h-8 w-8 mx-auto text-primary" />
                  <p className="text-sm font-medium">Drop file here</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="border-t px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground tabular-nums">
              <span>{charCount} chars</span>
              <span className="text-muted-foreground/30">|</span>
              <span>{wordCount} words</span>
            </div>

            <div className="flex items-center gap-2 sm:ml-auto">
              {!room?.files || room.files.length === 0 ? (
                <div className="relative">
                  <input
                    type="file"
                    id="file-upload"
                    className="hidden"
                    onChange={handleFileUpload}
                    accept="image/*,.pdf,.txt,.json,.csv,.md"
                    disabled={uploading}
                    multiple={false}
                  />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => document.getElementById("file-upload")?.click()}
                        disabled={uploading}
                        className="gap-2"
                      >
                        {uploading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4" />
                        )}
                        <span className="hidden sm:inline">
                          {uploading ? "Uploading..." : "Upload"}
                        </span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Upload file (max 500KB)</TooltipContent>
                  </Tooltip>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground px-2">1 file attached</span>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={downloadText} disabled={!room?.text} variant="outline" size="sm" className="gap-2">
                    <Download className="h-4 w-4" />
                    <span className="hidden sm:inline">Download</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Download as text file</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={copyText} disabled={!room?.text} variant="default" size="sm" className="gap-2">
                    <Copy className="h-4 w-4" />
                    <span className="hidden sm:inline">Copy</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Copy text to clipboard</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>
      </div>

      <CompressionDialog
        open={showCompressionDialog}
        pendingFile={pendingFile}
        compressionEstimate={compressionEstimate}
        imageQuality={imageQuality}
        compressing={compressing}
        compressionProgress={compressionProgress}
        onQualityChange={handleQualityChange}
        onCompress={handleCompressAndUpload}
        onCancel={handleCancelCompression}
      />
    </main>
  );
}