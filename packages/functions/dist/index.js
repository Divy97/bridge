"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupOldRooms = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
// Initialize the app
admin.initializeApp();
const db = admin.firestore();
/**
 * A scheduled function that runs every 5 hours.
 * It finds all rooms that haven't been updated in 5 hours
 * and deletes them in a batch.
 */
exports.cleanupOldRooms = functions
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
//# sourceMappingURL=index.js.map