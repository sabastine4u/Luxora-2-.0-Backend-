const mongoose = require("mongoose");
require("dotenv").config();
const DBSTRING = process.env.DBSTRING;

const connectDB = async () => {
    try {
        console.log('connecting to database');
        await mongoose.connect(DBSTRING, {});
        console.log('connected to database successfully ✅');
        // good to have
        mongoose.connection.on('disconnected', () => {
            console.warn('DB disconnected. Attempting reconnection')
        });
        mongoose.connection.on('reconnected', () => {
            console.info('DB reconnected');
        });

        mongoose.connection.on('error', (err) => {
            console.error('DB connection err:', err);
        });
    } catch (err) {
        console.log('error connecting to database:', err);
        //god to have 
        process.exit(1);
    }
}

module.exports = connectDB