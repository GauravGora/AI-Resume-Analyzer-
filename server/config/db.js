import mongoose from "mongoose";

let mongoServer = null;

const connectDB = async () => {
  try {
    let uri = process.env.MONGODB_URI?.trim();

    if (!uri) {
      console.log("No MONGODB_URI found in environment.");
      console.log("Starting in-memory MongoDB server for local development...");
      const { MongoMemoryServer } = await import("mongodb-memory-server");
      mongoServer = await MongoMemoryServer.create();
      uri = mongoServer.getUri();
      console.log("In-memory MongoDB server started successfully.");
    }

    await mongoose.connect(uri);
    console.log(`MongoDB connected successfully ${mongoServer ? "(In-Memory Dev DB)" : ""}`);
  } catch (error) {
    console.error("MongoDB connection error:", error.message);
    process.exit(1);
  }
};

const disconnectDB = async () => {
  try {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  } catch (err) {
    console.error("Error during DB disconnect:", err.message);
  }
};

process.on("SIGINT", async () => {
  await disconnectDB();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await disconnectDB();
  process.exit(0);
});

export default connectDB;