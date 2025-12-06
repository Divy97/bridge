/**
 * Encryption/Decryption utilities using Web Crypto API
 * Uses AES-GCM for authenticated encryption
 */

// Derive a per-room salt from the room code
const deriveRoomSalt = async (roomCode: string): Promise<Uint8Array> => {
  const encoder = new TextEncoder();
  const roomCodeData = encoder.encode(roomCode.toUpperCase());
  
  // Hash the room code to create a deterministic but unique salt
  const hashBuffer = await crypto.subtle.digest("SHA-256", roomCodeData);
  const hashArray = new Uint8Array(hashBuffer);
  
  // Use first 16 bytes of the hash as salt 
  // Create a new Uint8Array with explicit ArrayBuffer to ensure type compatibility
  const salt = new Uint8Array(16);
  salt.set(hashArray.subarray(0, 16));
  return salt;
};

// Derive an encryption key from the key material using PBKDF2
// Uses a per-room salt for better security isolation
const deriveKey = async (roomCode: string): Promise<CryptoKey> => {
  const keyMaterial = process.env.NEXT_PUBLIC_ENCRYPTION_KEY;
  
  if (!keyMaterial) {
    throw new Error(
      "NEXT_PUBLIC_ENCRYPTION_KEY environment variable is not set. " +
      "This is required for encryption/decryption. Please set it in your environment variables."
    );
  }
  
  // Convert the key material to a format suitable for PBKDF2
  const encoder = new TextEncoder();
  const passwordData = encoder.encode(keyMaterial);
  
  // Derive a unique salt for this room
  const salt = await deriveRoomSalt(roomCode);
  
  // Import the password as a key for PBKDF2
  const passwordKey = await crypto.subtle.importKey(
    "raw",
    passwordData,
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );
  
  // Derive the AES-GCM key from the password using the room-specific salt
  return await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: 100000,
      hash: "SHA-256",
    },
    passwordKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
};

/**
 * Encrypts a string using AES-GCM
 * @param plaintext - The text to encrypt
 * @param roomCode - The room code to derive a unique encryption key (required)
 * @returns Base64-encoded encrypted data with IV prepended
 */
export async function encryptText(plaintext: string, roomCode: string): Promise<string> {
  if (!plaintext) {
    return plaintext; // Return empty string as-is
  }

  if (!roomCode) {
    throw new Error("Room code is required for encryption");
  }

  try {
    const key = await deriveKey(roomCode);
    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);
    
    // Generate a random IV (Initialization Vector) for each encryption
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    // Encrypt the data
    const encryptedData = await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: iv,
      },
      key,
      data
    );
    
    // Combine IV and encrypted data
    const combined = new Uint8Array(iv.length + encryptedData.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encryptedData), iv.length);
    
    // Convert to base64 for storage
    return btoa(String.fromCharCode(...combined));
  } catch (error) {
    console.error("Encryption error:", error);
    throw new Error("Failed to encrypt text");
  }
}

/**
 * Decrypts a base64-encoded encrypted string
 * @param encryptedText - The encrypted text (base64 with IV prepended)
 * @param roomCode - The room code to derive the decryption key (required)
 * @returns The decrypted plaintext
 */
export async function decryptText(encryptedText: string, roomCode: string): Promise<string> {
  if (!encryptedText) {
    return encryptedText; // Return empty string as-is
  }

  if (!roomCode) {
    throw new Error("Room code is required for decryption");
  }

  try {
    // Check if the text looks like it might be encrypted (base64 format)
    // If it's not base64 or doesn't have the expected structure, return as-is
    // This allows backward compatibility with unencrypted data
    try {
      const combined = Uint8Array.from(atob(encryptedText), c => c.charCodeAt(0));
      
      // If the data is too short to contain IV + encrypted data, it's probably not encrypted
      if (combined.length < 13) {
        return encryptedText;
      }
      
      // Extract IV (first 12 bytes) and encrypted data (rest)
      const iv = combined.slice(0, 12);
      const encryptedData = combined.slice(12);
      
      const key = await deriveKey(roomCode);
      
      // Decrypt the data
      const decryptedData = await crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: iv,
        },
        key,
        encryptedData
      );
      
      // Convert back to string
      const decoder = new TextDecoder();
      return decoder.decode(decryptedData);
    } catch (decodeError) {
      // If decryption fails, assume it's unencrypted (for backward compatibility)
      console.warn("Decryption failed, assuming unencrypted text:", decodeError);
      return encryptedText;
    }
  } catch (error) {
    console.error("Decryption error:", error);
    // Return the original text if decryption fails (for backward compatibility)
    return encryptedText;
  }
}

