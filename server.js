// Load environment variables before any application modules are imported.
require("dotenv").config();
const app = require("./src/app");
const connectDB = require("./src/config/database");
const { createServer } = require("http");
const { initializeSocketServer } = require("./src/realtime/socket.service");

const PORT = Number(process.env.PORT) || 5000;

// Create the shared HTTP server for Express and Socket.IO.
const httpServer = createServer(app);

// Connect to MongoDB first so database-dependent
// API and Socket.IO authentication are ready before
// the server starts accepting requests.
connectDB()
  .then(() => {
    // Initialize Socket.IO after MongoDB is connected.
    initializeSocketServer(httpServer);

    // Start the Luxora backend only after the database
    // and realtime layer are ready.
    httpServer.listen(PORT, "0.0.0.0", () => {
      console.log(`Luxora Backend is running on port ${PORT}`);
    });
  })
  .catch((error) => {
    // Do not start the server when MongoDB is unavailable.
    console.error("Failed to start Luxora Backend:", error);

    process.exit(1);
  });
