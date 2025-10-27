"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  getRoom,
  streamRoom,
  updateRoomText,
  Room,
} from "@/lib/firebase-service";
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

  const params = useParams();
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  const roomCode = (params.roomCode as string)?.toUpperCase();

  // --- Debounced Text Update ---
  const debouncedUpdate = useDebouncedCallback((newText: string) => {
    if (!roomCode) return;
    updateRoomText(roomCode, newText);
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
        setError("Failed to load room.");
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
        <CardContent className="flex flex-1 p-0 min-h-0">
          <Textarea
            value={room?.text || ""}
            onChange={handleTextChange}
            placeholder="Start typing..."
            className="h-full w-full flex-1 resize-none border-0 bg-transparent p-6 font-mono text-base focus-visible:ring-0 overflow-y-auto"
          />
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

          {/* Right Side: Text Actions */}
          <div className="flex items-center space-x-2">
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