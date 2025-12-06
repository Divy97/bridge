"use client";

import { useEffect, useState } from "react";
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
  isImageType,
  formatFileSize,
  deleteFile,
} from "@/lib/file-service";
import { useDebouncedCallback } from "use-debounce";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2,
  Home,
  Copy,
  Users,
  Clock,
  Share2,
  Download,
  Eye,
  EyeOff,
  Sun,
  Moon,
  Upload,
  X,
  Image as ImageIcon,
  File,
  Shield,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Timestamp } from "firebase/firestore";

/**
 * Helper to safely format a Firebase Timestamp
 */
const formatDate = (timestamp: Timestamp | undefined) => {
  if (timestamp && typeof timestamp.toDate === "function") {
    return timestamp.toDate().toLocaleString(undefined, {
      dateStyle: "short",
      timeStyle: "short",
    });
  }
  return "N/A";
};

export default function RoomPage() {
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showFiles, setShowFiles] = useState(true);

  const params = useParams();
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  const roomCode = (params.roomCode as string)?.toUpperCase();

  // --- Debounced Text Update ---
  const debouncedUpdate = useDebouncedCallback(async (newText: string) => {
    if (!roomCode) return;
    try {
      await updateRoomText(roomCode, newText);
    } catch (err) {
      console.error("Error updating room text:", err);
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      
      // Check if it's an encryption error
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

  // --- Local Text Change Handler ---
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setRoom((prevRoom) => (prevRoom ? { ...prevRoom, text: newText } : null));
    debouncedUpdate(newText);
  };

  // --- Effect 1: Initial Data Fetch ---
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
        
        // Check if it's an encryption error
        if (errorMessage.includes("encryption") || errorMessage.includes("ENCRYPTION_KEY")) {
          setError("Encryption configuration error. Please check environment variables.");
          toast.error("Encryption Error", {
            description: "Failed to decrypt room data. Please contact support.",
          });
        } else {
          setError("Failed to load room.");
          toast.error("Failed to load room", {
            description: errorMessage,
          });
        }
      } finally {
        setLoading(false);
      }
    };

    fetchRoom();
  }, [roomCode, router]);

  // --- Effect 2: Real-time Listener ---
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

  // --- Action Handlers ---
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
          text: `Join my Bridge room: ${roomCode}`,
          url: roomUrl,
        });
      } else {
        throw new Error("Web Share API not supported");
      }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_error) {
      navigator.clipboard.writeText(roomUrl);
      toast.success("Room URL copied to clipboard!");
    }
  };

  // --- File Upload Handler ---
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !roomCode) return;

    // Check if a file already exists - only allow 1 file
    if (room?.files && room.files.length > 0) {
      toast.error("File already attached", {
        description: "Only 1 file is allowed per room. Please remove the existing file first.",
      });
      e.target.value = "";
      return;
    }

    // Pre-validate file size: Only files under 500KB are allowed
    const MAX_SIZE = 500 * 1024; // 500KB
    if (file.size > MAX_SIZE) {
      toast.error("File too large", {
        description: `Only files under 500KB are allowed. Your file is ${formatFileSize(file.size)}. Please choose a smaller file.`,
        duration: 5000,
      });
      e.target.value = "";
      return;
    }

    setUploading(true);
    try {
      // Use Base64 storage (free, no Firebase Storage needed)
      // Only files under 500KB are allowed
      const attachment = await uploadFile(file, roomCode, true);
      const fileData = fileAttachmentToFirestore(attachment);
      await addFileToRoom(roomCode, fileData);
      
      const fileSizeDisplay = formatFileSize(file.size);
      toast.success("File uploaded!", {
        description: `${file.name} (${fileSizeDisplay}) - auto-deletes in 30 minutes.`,
      });
    } catch (err) {
      console.error("Error uploading file:", err);
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      
      // Show graceful error messages
      if (errorMessage.includes("500KB") || errorMessage.includes("size")) {
        toast.error("File size limit exceeded", {
          description: errorMessage,
          duration: 5000,
        });
      } else if (errorMessage.includes("not supported") || errorMessage.includes("type")) {
        toast.error("File type not supported", {
          description: errorMessage,
          duration: 5000,
        });
      } else {
        toast.error("Upload failed", {
          description: errorMessage,
          duration: 5000,
        });
      }
    } finally {
      setUploading(false);
      // Reset input
      e.target.value = "";
    }
  };

  // --- File Delete Handler ---
  const handleFileDelete = async (
    fileId: string,
    fileName: string,
    storageType?: "storage" | "base64"
  ) => {
    if (!roomCode) return;
    try {
      await removeFileFromRoom(roomCode, fileId);
      await deleteFile(roomCode, fileId, fileName, storageType);
      toast.success("File removed", {
        description: `${fileName} has been removed from the room.`,
      });
    } catch (err) {
      console.error("Error deleting file:", err);
      toast.error("Failed to remove file", {
        description: "Please try again.",
        duration: 3000,
      });
    }
  };

  // --- Check if file is expired ---
  const isFileExpired = (expiresAt: Timestamp): boolean => {
    if (!expiresAt) return false;
    return expiresAt.toDate() < new Date();
  };

  // --- File Download Handler ---
  const handleFileDownload = async (file: FileAttachmentData) => {
    try {
      // Check if it's a data URL (Base64) or regular URL
      if (file.url.startsWith("data:")) {
        // For Base64 data URLs, convert to blob URL for better browser compatibility
        const response = await fetch(file.url);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        
        if (file.type === "application/pdf") {
          // For PDFs, open in new tab with blob URL (works better than data URLs)
          const newWindow = window.open(blobUrl, "_blank");
          if (newWindow) {
            // Clean up blob URL after window is closed or after delay
            newWindow.addEventListener("beforeunload", () => {
              URL.revokeObjectURL(blobUrl);
            });
            // Fallback cleanup after 5 minutes
            setTimeout(() => URL.revokeObjectURL(blobUrl), 5 * 60 * 1000);
          } else {
            // If popup blocked, trigger download instead
            const a = document.createElement("a");
            a.href = blobUrl;
            a.download = file.name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
          }
        } else {
          // For other files, trigger download
          const a = document.createElement("a");
          a.href = blobUrl;
          a.download = file.name;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
        }
      } else {
        // For regular URLs (Firebase Storage)
        if (file.type === "application/pdf") {
          // Open PDF in new tab
          const newWindow = window.open(file.url, "_blank");
          if (!newWindow) {
            // If popup blocked, fall back to download
            const a = document.createElement("a");
            a.href = file.url;
            a.download = file.name;
            a.target = "_blank";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          }
        } else {
          // For other files, trigger download
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
      toast.error("Failed to open file", {
        description: "Please try again.",
      });
    }
  };

  // --- Render Logic: Loading State ---
  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 p-4">
        <div className="text-center space-y-4">
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
          <h2 className="text-xl font-semibold">Loading Room...</h2>
          <p className="text-muted-foreground">Connecting to {roomCode}</p>
        </div>
      </main>
    );
  }

  // --- Render Logic: Error State ---
  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 p-4">
        <Card className="max-w-md shadow-2xl border-0 bg-card/50 backdrop-blur-sm">
          <CardContent className="space-y-6 p-8 text-center">
            <h1 className="text-2xl font-semibold text-destructive">{error}</h1>
            <p className="text-muted-foreground">
              The room you&apos;re looking for doesn&apos;t exist or has been removed.
            </p>
            <Button onClick={() => router.push("/")} className="w-full">
              <Home className="mr-2 h-4 w-4" />
              Go Home
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  // --- Render Logic: Main Page ---
  return (
    <main className="h-screen bg-gradient-to-br from-background via-background to-muted/20 flex flex-col overflow-hidden">
      {/* Unified App Card */}
      <Card className="flex w-full max-w-5xl flex-col shadow-2xl border-0 bg-card/50 backdrop-blur-sm h-full mx-auto my-4">
        
        {/* Card Header: Info & Page Actions */}
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            {/* Left Side: Title & Status */}
            <div>
              <CardTitle className="font-mono text-2xl tracking-widest text-primary">
                {roomCode}
              </CardTitle>
              <div className="mt-2 flex items-center space-x-2">
                <span
                  className={`h-2 w-2 rounded-full ${
                    isConnected ? "bg-green-500" : "bg-gray-400"
                  }`}
                />
                <span className="text-xs text-muted-foreground">
                  {isConnected ? "Connected" : "Connecting..."}
                </span>
              </div>
            </div>

            {/* Right Side: Page Actions */}
            <div className="flex items-center space-x-2">
              <Button onClick={shareRoom} variant="outline" size="icon">
                <Share2 className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              >
                <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              </Button>
              <Button
                onClick={() => router.push("/")}
                variant="outline"
                size="icon"
              >
                <Home className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        {/* Card Content: The Editor (Stretches to fill space) */}
        <CardContent className="flex flex-1 flex-col p-0 min-h-0">
          {/* Files Section */}
          {showFiles && room?.files && room.files.length > 0 && (
            <div className="border-b p-4 space-y-3 max-h-64 overflow-y-auto">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <File className="h-4 w-4" />
                  Attached File
                </h3>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Shield className="h-3 w-3" />
                  <span>Auto-deletes in 30 min</span>
                </div>
              </div>
              <div className="bg-muted/50 border border-primary/20 rounded-md p-2 text-xs text-muted-foreground flex items-start gap-2">
                <Shield className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <div>
                    <strong>Privacy Feature:</strong> All uploaded files are automatically deleted after 30 minutes for your privacy and security.
                  </div>
                  <div className="mt-1.5 text-[10px] opacity-90 font-medium">
                    📦 <strong>File Size Limit:</strong> Only files under 500KB are allowed. Files are stored for free using Base64 encoding.
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                {room.files.map((file) => {
                  const expired = isFileExpired(file.expiresAt);
                  return (
                    <div
                      key={file.id}
                      className={`relative group border rounded-lg p-3 ${
                        expired ? "opacity-50" : ""
                      }`}
                    >
                      {isImageType(file.type) ? (
                        <div className="space-y-2">
                          <div className="relative group/image">
                            <img
                              src={file.url}
                              alt={file.name}
                              className="w-full h-32 object-cover rounded"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = "none";
                              }}
                            />
                            {/* Remove button overlay for images */}
                            <Button
                              variant="destructive"
                              size="icon"
                              className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover/image:opacity-100 transition-opacity bg-destructive/90 hover:bg-destructive"
                              onClick={() => handleFileDelete(file.id, file.name, file.storageType)}
                              title="Remove file"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground truncate flex-1" title={file.name}>
                              {file.name}
                            </span>
                            <span className="text-xs text-muted-foreground ml-2">
                              {formatFileSize(file.size)}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <File className="h-4 w-4 flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm truncate">{file.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatFileSize(file.size)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleFileDownload(file)}
                              title={file.type === "application/pdf" ? "Open PDF" : "Download file"}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="destructive"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleFileDelete(file.id, file.name, file.storageType)}
                              title="Remove file"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                      {expired && (
                        <div className="absolute inset-0 bg-background/50 rounded-lg flex items-center justify-center">
                          <span className="text-xs text-muted-foreground">Expired</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Text Editor */}
          <div className="flex-1 flex flex-col min-h-0">
            <Textarea
              value={room?.text || ""}
              onChange={handleTextChange}
              placeholder="Start typing..."
              className="h-full w-full flex-1 resize-none border-0 bg-transparent p-6 font-mono text-base focus-visible:ring-0 overflow-y-auto"
            />
          </div>
        </CardContent>

        {/* Card Footer: Stats & Text Actions */}
        <CardFooter className="flex flex-wrap items-center justify-between gap-4 border-t pt-4">
          {/* Left Side: Stats */}
          <div className="flex items-center space-x-4">
            <Button
              onClick={() => setShowStats(!showStats)}
              variant="ghost"
              size="icon"
              className="text-muted-foreground"
            >
              {showStats ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            {showStats && (
              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                <div className="flex items-center space-x-1.5">
                  <Users className="h-3 w-3" />
                  <span>{room?.text.length || 0} Chars</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <Users className="h-3 w-3" />
                  <span>
                    {room?.text.trim()
                      ? room.text.trim().split(/\s+/).length
                      : 0}{" "}
                    Words
                  </span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <Clock className="h-3 w-3" />
                  <span>
                    Updated: {formatDate(room?.lastUpdatedAt)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Right Side: Actions */}
          <div className="flex items-center space-x-2">
            {/* File Upload - Better UX with text label */}
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
                <Button
                  variant="outline"
                  onClick={() => document.getElementById("file-upload")?.click()}
                  disabled={uploading}
                  className="gap-2"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      Upload File
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="text-xs text-muted-foreground px-2">
                1 file attached
              </div>
            )}
            <Button
              onClick={downloadText}
              disabled={!room?.text}
              variant="outline"
            >
              <Download className="mr-2 h-4 w-4" />
              Download
            </Button>
            <Button
              onClick={copyText}
              disabled={!room?.text}
              variant="default"
            >
              <Copy className="mr-2 h-4 w-4" />
              Copy Text
            </Button>
          </div>
        </CardFooter>

        {/* Footer with GitHub Link */}
        <div className="border-t px-6 py-3 text-center">
          <p className="text-xs text-muted-foreground">
            Made by{" "}
            <a
              href="https://github.com/Divy97"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Divy97
            </a>
          </p>
        </div>
      </Card>
    </main>
  );
}