const app = require('./src/app');
const connectDB = require('./src/config/database');

const PORT = 5000;


connectDB();
app.listen(PORT, () => {
    console.log(`Luxora Backend is running on http://localhost:${PORT}`);
});
    