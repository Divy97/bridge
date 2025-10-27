"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, Plus, ArrowRight, Sun, Moon } from "lucide-react";
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
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header with Theme Toggle */}
      <header className="absolute top-0 right-0 p-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </header>

      {/* Main Content */}
      <main className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-8">
          {/* Logo and Title */}
          <div className="space-y-2 text-center">
            <h1 className="pb-1 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-5xl font-bold tracking-tighter text-transparent">
              Bridge
            </h1>
            <p className="text-lg text-muted-foreground">
              Your real-time clipboard.
            </p>
          </div>

          {/* Actions */}
          <div className="space-y-6">
            {/* Create Room (Primary Action) */}
            <Button
              onClick={handleCreateRoom}
              disabled={isCreating || isJoining}
              className="h-12 w-full text-base font-medium"
              size="lg"
            >
              {isCreating ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <Plus className="mr-2 h-5 w-5" />
              )}
              Create New Room
            </Button>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or
                </span>
              </div>
            </div>

            {/* Join Room (Secondary Action) */}
            <form onSubmit={handleJoinRoom} className="flex space-x-2">
              <Input
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="AAAA"
                maxLength={4}
                disabled={isCreating || isJoining}
                className="h-12 flex-1 text-center font-mono text-lg uppercase tracking-widest"
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

      {/* Footer */}
      <footer className="flex items-center justify-center p-4">
        <p className="text-xs text-muted-foreground">
          Share text instantly. No sign-up required.
        </p>
      </footer>
    </div>
  );
}