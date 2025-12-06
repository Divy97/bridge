import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

// Initialize the app
admin.initializeApp();

const db = admin.firestore();
const storage = admin.storage();

/**
 * A scheduled function that runs every 5 hours.
 * It finds all rooms that haven't been updated in 5 hours
 * and deletes them in a batch.
 */
export const cleanupOldRooms = functions
  .region("asia-south1") // <-- Optional: Set this to your Firestore region
  .pubsub.schedule("0 */5 * * *") // "At minute 0 past every 5th hour"
  .timeZone("Asia/Kolkata") // Optional: Set to your timezone
  .onRun(async (context) => {
    const now = new Date();
    // Calculate the timestamp 5 hours ago
    const fiveHoursAgo = new Date(now.getTime() - 5 * 60 * 60 * 1000);

    console.log("Running cleanup job. Deleting rooms older than:", fiveHoursAgo);

    // 1. Query for all rooms last updated 5+ hours ago
    const oldRoomsQuery = db
      .collection("rooms")
      .where("lastUpdatedAt", "<", fiveHoursAgo);

    const snapshot = await oldRoomsQuery.get();

    if (snapshot.empty) {
      console.log("No old rooms to delete.");
      return null;
    }

    // 2. Create a batch to delete all docs at once
    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    // 3. Commit the batch
    await batch.commit();

    console.log(`Successfully deleted ${snapshot.size} old rooms.`);
    return null;
  });

/**
 * A scheduled function that runs every 5 minutes.
 * It finds all files that have expired (30 minutes after upload)
 * and deletes them from Storage and removes references from Firestore.
 */
export const cleanupExpiredFiles = functions
  .region("asia-south1")
  .pubsub.schedule("*/15 * * * *") // Every 15 minutes
  .timeZone("Asia/Kolkata")
  .onRun(async (context) => {
    const now = admin.firestore.Timestamp.now();
    console.log("Running expired files cleanup job at:", now.toDate());

    // 1. Get all rooms
    const roomsSnapshot = await db.collection("rooms").get();

    if (roomsSnapshot.empty) {
      console.log("No rooms found.");
      return null;
    }

    let totalFilesDeleted = 0;
    let totalFilesRemoved = 0;

    // 2. Process each room
    for (const roomDoc of roomsSnapshot.docs) {
      const roomData = roomDoc.data();
      const files = roomData.files || [];
      
      if (files.length === 0) continue;

      const expiredFiles: string[] = [];
      const validFiles: any[] = [];

      // 3. Check each file for expiration
      for (const file of files) {
        if (file.expiresAt && file.expiresAt.toMillis() < now.toMillis()) {
          expiredFiles.push(file.id);
          
          // Only delete from Storage if it's a storage type file
          // Base64 files are stored in Firestore, so they're removed when we update the room
          if (file.storageType === "storage" || !file.storageType) {
            // Default to storage if type not specified (backward compatibility)
            try {
              const filePath = `rooms/${roomDoc.id}/${file.id}/${file.name}`;
              const bucket = storage.bucket();
              const fileRef = bucket.file(filePath);
              
              const [exists] = await fileRef.exists();
              if (exists) {
                await fileRef.delete();
                totalFilesDeleted++;
                console.log(`Deleted file from Storage: ${filePath}`);
              }
            } catch (error) {
              console.error(`Error deleting file ${file.id} from Storage:`, error);
              // Continue even if storage deletion fails
            }
          } else {
            // Base64 file - just log, will be removed from Firestore below
            console.log(`Removing Base64 file ${file.id} from Firestore`);
          }
        } else {
          validFiles.push(file);
        }
      }

      // 4. Update room document to remove expired files
      if (expiredFiles.length > 0) {
        await roomDoc.ref.update({
          files: validFiles,
          lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        totalFilesRemoved += expiredFiles.length;
        console.log(
          `Removed ${expiredFiles.length} expired files from room ${roomDoc.id}`
        );
      }
    }

    console.log(
      `Cleanup complete. Deleted ${totalFilesDeleted} files from Storage, removed ${totalFilesRemoved} file references from Firestore.`
    );
    return null;
  });