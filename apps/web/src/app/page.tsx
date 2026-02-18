"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { Loader2, Plus, ArrowRight, Sun, Moon, Lock, Zap, UserX } from "lucide-react";
import { useTheme } from "next-themes";
import { createRoom } from "@/lib/firebase-service";

export default function HomePage() {
  const [roomCode, setRoomCode] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  const handleCreateRoom = async () => {
    setIsCreating(true);
    try {
      const newRoomCode = await createRoom();
      toast.success("Room Created!", {
        description: `Redirecting you to room ${newRoomCode}`,
      });
      router.push(`/${newRoomCode}`);
    } catch (error) {
      console.error("Error creating room:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      toast.error("Failed to create room", {
        description: errorMessage,
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomCode.trim().length !== 4) {
      toast.error("Invalid Code", {
        description: "Room code must be 4 letters.",
      });
      return;
    }
    setIsJoining(true);
    router.push(`/${roomCode.trim().toUpperCase()}`);
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-background bg-dot-grid">
      <header className="absolute top-0 right-0 p-4 z-10">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="rounded-full"
            >
              <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className="sr-only">Toggle theme</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Toggle theme</TooltipContent>
        </Tooltip>
      </header>

      <main className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-sm stagger-children">
          <div className="space-y-3 text-center">
            <h1 className="pb-2 bg-gradient-to-r from-foreground via-foreground/80 to-foreground/50 bg-clip-text text-6xl font-bold tracking-tighter text-transparent">
              Bridge
            </h1>
            <p className="text-lg text-muted-foreground">
              Your real-time clipboard.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <Badge variant="secondary" className="gap-1.5 px-3 py-1 text-xs font-normal">
                <Lock className="h-3 w-3" />
                End-to-end encrypted
              </Badge>
              <Badge variant="secondary" className="gap-1.5 px-3 py-1 text-xs font-normal">
                <Zap className="h-3 w-3" />
                Real-time sync
              </Badge>
              <Badge variant="secondary" className="gap-1.5 px-3 py-1 text-xs font-normal">
                <UserX className="h-3 w-3" />
                No sign-up required
              </Badge>
            </div>
          </div>

          <div className="mt-10 space-y-6">
            <Button
              onClick={handleCreateRoom}
              disabled={isCreating || isJoining}
              className="h-13 w-full text-base font-semibold shadow-lg shadow-primary/20 transition-shadow hover:shadow-xl hover:shadow-primary/30"
              size="lg"
            >
              {isCreating ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <Plus className="mr-2 h-5 w-5" />
              )}
              Create New Room
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <Separator />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-3 text-muted-foreground">
                  Or join existing
                </span>
              </div>
            </div>

            <form onSubmit={handleJoinRoom} className="flex gap-2">
              <Input
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="AAAA"
                maxLength={4}
                disabled={isCreating || isJoining}
                className="h-12 flex-1 text-center font-mono text-lg uppercase tracking-[0.3em]"
              />
              <Button
                type="submit"
                disabled={isCreating || isJoining || roomCode.length !== 4}
                className="h-12 w-28"
                variant="outline"
              >
                {isJoining ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Join
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          </div>
        </div>
      </main>

      <footer className="flex items-center justify-center p-4">
        <p className="text-xs text-muted-foreground/60">
          Share text instantly between devices.
        </p>
      </footer>
    </div>
  );
}