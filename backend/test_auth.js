const axios = require('axios');
const mongoose = require('mongoose');
const User = require('./models/User');
const crypto = require('crypto');

const API_URL = 'http://localhost:3000';
const MONGO_URI = "mongodb://127.0.0.1:27017/ehr_db";

// Test Data
const testUser = {
    userId: "test_user_" + Date.now(),
    password: "securePassword123",
    name: "Test User Encrypted",
    role: "patient"
};

function hashId(id) {
    return crypto.createHash('sha256').update(id).digest('hex');
}

async function runTest() {
    console.log("Starting Secur ID Test...");

    try {
        // 1. Register User
        console.log(`\n1. Registering user: ${testUser.userId}`);
        const regRes = await axios.post(`${API_URL}/register`, testUser);
        console.log("   Registration Response:", regRes.data);

        // 2. Verify Database Storage (Check for Hash)
        await mongoose.connect(MONGO_URI);

        // Should NOT find by plain ID
        const userByPlain = await User.findOne({ userId: testUser.userId });
        if (userByPlain) {
            console.error("   ❌ FAILURE: Plain Text User ID FOUND in DB!");
        } else {
            console.log("   ✅ SUCCESS: Plain Text User ID NOT found in DB.");
        }

        // Should find by Hash
        const expectedHash = hashId(testUser.userId);
        const userByHash = await User.findOne({ userIdHash: expectedHash });

        if (userByHash) {
            console.log("   ✅ SUCCESS: User found by Hash.");
            console.log(`      Stored Hash: ${userByHash.userIdHash.substring(0, 20)}...`);

            if (userByHash.userIdEnc) {
                console.log("   ✅ SUCCESS: Encrypted ID (userIdEnc) exists.");
            } else {
                console.error("   ❌ FAILURE: userIdEnc missing.");
            }

            if (userByHash.password.startsWith("$2b$")) {
                console.log("   ✅ SUCCESS: Password is hashed.");
            }
        } else {
            console.error("   ❌ FAILURE: User NOT found by Hash.");
        }

        await mongoose.disconnect();

        // 3. Login with Correct Password
        console.log(`\n2. Logging in...`);
        try {
            const loginRes = await axios.post(`${API_URL}/login`, {
                userId: testUser.userId,
                password: testUser.password,
                role: testUser.role
            });
            console.log("   ✅ SUCCESS: Login successful.");
            if (loginRes.data.userId === testUser.userId) {
                console.log("   ✅ SUCCESS: Returned userId matches input.");
            }
        } catch (err) {
            console.error("   ❌ FAILURE: Login failed.", err.response ? err.response.data : err.message);
        }

    } catch (err) {
        console.error("Test Script Error:", err.message);
        if (err.response) console.error("Response Data:", err.response.data);
    }
}

runTest();
