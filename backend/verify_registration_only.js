const axios = require('axios');
const mongoose = require('mongoose');
const User = require('./models/User');
const crypto = require('crypto');

const API_URL = 'http://localhost:3000';
const MONGO_URI = "mongodb://127.0.0.1:27017/ehr_db";

// Test Data
const patient = {
    userId: "patient_ver_" + Date.now(),
    password: "password123",
    name: "Verification Patient",
    role: "patient"
};

function hashId(id) {
    return crypto.createHash('sha256').update(id).digest('hex');
}

async function runTest() {
    console.log("Starting Registration Verification...");

    try {
        // 1. Register
        console.log(`Registering ${patient.userId}...`);
        await axios.post(`${API_URL}/register`, patient);
        console.log("✅ Registration API Success");

        // 2. Check DB
        await mongoose.connect(MONGO_URI);

        const hash = hashId(patient.userId);
        const user = await User.findOne({ userIdHash: hash });

        if (user) {
            console.log("✅ User found in DB by Hash");
            console.log("   Hash:", user.userIdHash);
            console.log("   Encrypted ID:", user.userIdEnc);

            if (!user.userId) {
                console.log("✅ Plain userId is NOT present (Correct)");
            } else {
                console.error("❌ Plain userId IS present (Incorrect)");
            }
        } else {
            console.error("❌ User NOT found in DB by Hash");
        }

        await mongoose.disconnect();

    } catch (err) {
        console.error("Verification Error:", err.message);
        if (err.response) {
            console.error("Response:", String(err.response.data).substring(0, 200));
        }
    }
}

runTest();
