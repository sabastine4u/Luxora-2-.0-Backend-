const app = require('./src/app');
const connectDB = require('./src/config/database');
const { createServer } = require("http");
const { initializeSocketServer } = require("./src/realtime/socket.service");

const PORT = 5000;


const httpServer = createServer(app);
initializeSocketServer(httpServer);

connectDB();
httpServer.listen(PORT, () => {
    console.log(`Luxora Backend is running on http://localhost:${PORT}`);
});
