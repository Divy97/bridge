import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

// Initialize the app
admin.initializeApp();

const db = admin.firestore();

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