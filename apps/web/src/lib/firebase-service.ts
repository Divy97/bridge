import { auth, db } from "@/lib/firebase";
import { generateRoomCode } from "@/lib/room-code";
import { signInAnonymously } from "firebase/auth";
import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
  DocumentReference,
  Timestamp,
  updateDoc, 
  onSnapshot, 
  Unsubscribe, 
} from "firebase/firestore";

// Room document Schema
export interface Room {
  text: string;
  lastUpdatedAt: Timestamp;
  createdAt: Timestamp;
}

// Sign in anonymously if needed
export async function signInAnonymouslyIfNeeded() {
  if (!auth.currentUser) {
    try {
      await signInAnonymously(auth);
    } catch (_error) {
      // Ignore error
    }
  }
}

// Create a new room with a unique code
export async function createRoom(): Promise<string> {
  await signInAnonymouslyIfNeeded();

  let roomCode: string = "";
  let roomRef: DocumentReference | null = null;
  const maxAttempts = 10;

  for (let attempts = 0; attempts < maxAttempts; attempts++) {
    roomCode = generateRoomCode();
    roomRef = doc(db, "rooms", roomCode);
    const roomSnap = await getDoc(roomRef);

    if (!roomSnap.exists()) {
      break; // Found unique code
    }
    if (attempts === maxAttempts - 1) {
      throw new Error("Failed to generate unique room code.");
    }
  }

  if (!roomRef) {
    throw new Error("Failed to create room reference");
  }

  const newRoom: Room = {
    text: "", // Start with empty text
    lastUpdatedAt: serverTimestamp() as Timestamp,
    createdAt: serverTimestamp() as Timestamp,
  };

  await setDoc(roomRef, newRoom);
  return roomCode;
}

// Get a room by its code
export async function getRoom(roomCode: string): Promise<Room | null> {
  await signInAnonymouslyIfNeeded();
  const roomRef = doc(db, "rooms", roomCode);
  const roomSnap = await getDoc(roomRef);
  if (!roomSnap.exists()) {
    return null;
  }
  return roomSnap.data() as Room;
}

// Update the text content of a room
export async function updateRoomText(roomCode: string, newText: string) {
  await signInAnonymouslyIfNeeded();
  const roomRef = doc(db, "rooms", roomCode);
  
  await updateDoc(roomRef, {
    text: newText,
    lastUpdatedAt: serverTimestamp(),
  });
}

// Stream real-time updates to a room
export function streamRoom(
  roomCode: string,
  onRoomUpdate: (room: Room) => void
): Unsubscribe {
  const roomRef = doc(db, "rooms", roomCode);
  
  const unsubscribe = onSnapshot(
    roomRef,
    (docSnap) => {
      if (docSnap.exists()) {
        const roomData = docSnap.data() as Room;
        onRoomUpdate(roomData);
      } else {
        // This case would be handled if the room gets deleted
        console.warn(`Room ${roomCode} no longer exists.`);
      }
    },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (_error) => {
      // Ignore error
    }
  );

  return unsubscribe;
}