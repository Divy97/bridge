import { auth, db } from "@/lib/firebase";
import { generateRoomCode } from "@/lib/room-code";
import { encryptText, decryptText } from "@/lib/crypto";
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
  DocumentSnapshot,
  FirestoreError,
} from "firebase/firestore";

// File attachment schema (stored in Firestore)
export interface FileAttachmentData {
  id: string;
  name: string;
  type: string;
  size: number; // Compressed/actual size
  originalSize?: number; // Original size before compression
  url: string;
  uploadedAt: Timestamp;
  expiresAt: Timestamp;
  data?: string; // Base64 data for free storage
  storageType?: "storage" | "base64"; // How file is stored
  wasCompressed?: boolean; // Whether file was compressed
}

// Room document Schema
export interface Room {
  text: string;
  files?: FileAttachmentData[];
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

  // Encrypt the initial empty text using the room code
  let encryptedText: string;
  try {
    encryptedText = await encryptText("", roomCode);
  } catch (error) {
    console.error("Failed to encrypt initial text:", error);
    throw new Error("Failed to encrypt text. Please check encryption configuration.");
  }

  const newRoom: Room = {
    text: encryptedText, // Store encrypted text
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
  const roomData = roomSnap.data() as Room;
  
  // Decrypt the text before returning
  if (roomData.text) {
    try {
      roomData.text = await decryptText(roomData.text, roomCode);
    } catch (error) {
      console.error("Failed to decrypt room text:", error);
      throw new Error("Failed to decrypt room data. Please check encryption configuration.");
    }
  }
  
  return roomData;
}

// Update the text content of a room
export async function updateRoomText(roomCode: string, newText: string) {
  await signInAnonymouslyIfNeeded();
  const roomRef = doc(db, "rooms", roomCode);
  
  // Encrypt the text before storing using the room code
  let encryptedText: string;
  try {
    encryptedText = await encryptText(newText, roomCode);
  } catch (error) {
    console.error("Failed to encrypt text:", error);
    throw new Error("Failed to encrypt text. Please check encryption configuration.");
  }
  
  await updateDoc(roomRef, {
    text: encryptedText,
    lastUpdatedAt: serverTimestamp(),
  });
}

// Add a file attachment to a room
export async function addFileToRoom(
  roomCode: string,
  fileAttachment: FileAttachmentData
) {
  await signInAnonymouslyIfNeeded();
  const roomRef = doc(db, "rooms", roomCode);
  const roomSnap = await getDoc(roomRef);
  
  if (!roomSnap.exists()) {
    throw new Error("Room not found");
  }

  const currentFiles = (roomSnap.data() as Room).files || [];
  
  await updateDoc(roomRef, {
    files: [...currentFiles, fileAttachment],
    lastUpdatedAt: serverTimestamp(),
  });
}

// Remove a file attachment from a room
export async function removeFileFromRoom(roomCode: string, fileId: string) {
  await signInAnonymouslyIfNeeded();
  const roomRef = doc(db, "rooms", roomCode);
  const roomSnap = await getDoc(roomRef);
  
  if (!roomSnap.exists()) {
    throw new Error("Room not found");
  }

  const currentFiles = (roomSnap.data() as Room).files || [];
  const updatedFiles = currentFiles.filter((f) => f.id !== fileId);
  
  await updateDoc(roomRef, {
    files: updatedFiles,
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
    async (docSnap: DocumentSnapshot) => {
      if (docSnap.exists()) {
        const roomData = docSnap.data() as Room;
        
        // Decrypt the text before calling the callback
        if (roomData.text) {
          try {
            roomData.text = await decryptText(roomData.text, roomCode);
          } catch (error) {
            console.error("Failed to decrypt room text:", error);
            // Continue with encrypted text if decryption fails
          }
        }
        
        onRoomUpdate(roomData);
      } else {
        // This case would be handled if the room gets deleted
        console.warn(`Room ${roomCode} no longer exists.`);
      }
    },
    (error: FirestoreError) => {
      console.error("Firestore snapshot error:", error);
      // Don't silently ignore errors in production - log them
    }
  );

  return unsubscribe;
}