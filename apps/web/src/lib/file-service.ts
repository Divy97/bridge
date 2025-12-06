import { storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { Timestamp } from "firebase/firestore";

export interface FileAttachment {
  id: string;
  name: string;
  type: string;
  size: number; // Compressed/actual size
  originalSize?: number; // Original size before compression
  url: string;
  uploadedAt: Date;
  expiresAt: Date; // 30 minutes from upload
   // For Base64 storage
  data?: string; // Base64 encoded file data
  storageType?: "storage" | "base64"; // How the file is stored
  wasCompressed?: boolean; // Whether file was compressed
}

// Storage limits
const MAX_FILE_SIZE_STORAGE = 10 * 1024 * 1024; // 10MB for Firebase Storage
const MAX_FILE_SIZE_BASE64 = 500 * 1024; // 500KB for Base64 (Firestore 1MB limit, ~33% Base64 overhead)
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"];
const ALLOWED_FILE_TYPES = [
  "text/plain",
  "text/markdown",
  "application/pdf",
  "application/json",
  "text/csv",
];

// Check if file type is allowed
export function isFileTypeAllowed(file: File): boolean {
  const type = file.type;
  return ALLOWED_IMAGE_TYPES.includes(type) || ALLOWED_FILE_TYPES.includes(type);
}

// Check if file is an image
export function isImageFile(file: File): boolean {
  return ALLOWED_IMAGE_TYPES.includes(file.type);
}

// Check if a file type string is an image
export function isImageType(type: string): boolean {
  return ALLOWED_IMAGE_TYPES.includes(type);
}

// Convert file to Base64
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix (e.g., "data:image/png;base64,")
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Upload a file using Base64 (free, stored in Firestore)
export async function uploadFileBase64(
  file: File,
  roomCode: string
): Promise<FileAttachment> {
  if (file.size > MAX_FILE_SIZE_BASE64) {
    throw new Error(
      `File size (${formatFileSize(file.size)}) exceeds 500KB limit. Only files under 500KB are allowed for free storage.`
    );
  }

  if (!isFileTypeAllowed(file)) {
    throw new Error("File type not supported. Allowed: images, PDF, text, JSON, CSV");
  }

  // Generate unique file ID
  const fileId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  // Convert to Base64
  const base64Data = await fileToBase64(file);
  
  // Create data URL for display
  const dataUrl = `data:${file.type};base64,${base64Data}`;

  // Calculate expiration (30 minutes from now)
  const uploadedAt = new Date();
  const expiresAt = new Date(uploadedAt.getTime() + 30 * 60 * 1000);

  return {
    id: fileId,
    name: file.name,
    type: file.type,
    size: file.size,
    url: dataUrl,
    data: base64Data,
    storageType: "base64",
    uploadedAt,
    expiresAt,
  };
}

// Upload a file to Firebase Storage (paid)
export async function uploadFileStorage(
  file: File,
  roomCode: string
): Promise<FileAttachment> {
  if (file.size > MAX_FILE_SIZE_STORAGE) {
    throw new Error(`File size exceeds ${MAX_FILE_SIZE_STORAGE / 1024 / 1024}MB limit`);
  }

  if (!isFileTypeAllowed(file)) {
    throw new Error("File type not supported. Allowed: images, PDF, text, JSON, CSV");
  }

  // Generate unique file ID
  const fileId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  // Use the original file name - Firebase Storage handles URL encoding automatically
  const storageRef = ref(storage, `rooms/${roomCode}/${fileId}/${file.name}`);

  // Upload file
  const snapshot = await uploadBytes(storageRef, file);
  const downloadURL = await getDownloadURL(snapshot.ref);

  // Calculate expiration (30 minutes from now)
  const uploadedAt = new Date();
  const expiresAt = new Date(uploadedAt.getTime() + 30 * 60 * 1000);

  return {
    id: fileId,
    name: file.name,
    type: file.type,
    size: file.size,
    url: downloadURL,
    storageType: "storage",
    uploadedAt,
    expiresAt,
  };
}

// Smart upload: use Base64 for files under 500KB (free)
export async function uploadFile(
  file: File,
  roomCode: string,
  useBase64: boolean = true // Default to free Base64 storage
): Promise<FileAttachment> {
  // Only allow files under 500KB for Base64 storage
  if (useBase64) {
    if (file.size <= MAX_FILE_SIZE_BASE64) {
      return uploadFileBase64(file, roomCode);
    } else {
      throw new Error(
        `File size (${formatFileSize(file.size)}) exceeds 500KB limit. Only files under 500KB are allowed.`
      );
    }
  } else {
    // Fallback to Storage for larger files (requires Firebase Storage setup)
    if (file.size <= MAX_FILE_SIZE_STORAGE) {
      return uploadFileStorage(file, roomCode);
    } else {
      throw new Error(`File size exceeds ${MAX_FILE_SIZE_STORAGE / 1024 / 1024}MB limit`);
    }
  }
}

// Convert FileAttachment to Firestore format
export function fileAttachmentToFirestore(
  attachment: FileAttachment
): {
  id: string;
  name: string;
  type: string;
  size: number;
  originalSize?: number;
  url: string;
  uploadedAt: Timestamp;
  expiresAt: Timestamp;
  data?: string;
  storageType?: "storage" | "base64";
  wasCompressed?: boolean;
} {
  const result: any = {
    id: attachment.id,
    name: attachment.name,
    type: attachment.type,
    size: attachment.size,
    url: attachment.url,
    uploadedAt: Timestamp.fromDate(attachment.uploadedAt),
    expiresAt: Timestamp.fromDate(attachment.expiresAt),
  };
  
  // Include original size if file was compressed
  if (attachment.originalSize !== undefined) {
    result.originalSize = attachment.originalSize;
  }
  
  // Include Base64 data if present
  if (attachment.data) {
    result.data = attachment.data;
  }
  
  if (attachment.storageType) {
    result.storageType = attachment.storageType;
  }
  
  if (attachment.wasCompressed !== undefined) {
    result.wasCompressed = attachment.wasCompressed;
  }
  
  return result;
}

// Delete a file from Firebase Storage (only needed for storage type files)
export async function deleteFile(
  roomCode: string,
  fileId: string,
  fileName: string,
  storageType?: "storage" | "base64"
): Promise<void> {
  // Base64 files are stored in Firestore, so deletion happens when room is updated
  // Only Storage files need to be deleted from Firebase Storage
  if (storageType === "base64") {
    return; // No-op for Base64 files
  }

  try {
    const storageRef = ref(storage, `rooms/${roomCode}/${fileId}/${fileName}`);
    await deleteObject(storageRef);
  } catch (error) {
    console.error("Error deleting file:", error);
    // Don't throw - file might already be deleted
  }
}

// Format file size for display
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
}
