const axios = require('axios');
const API_URL = 'http://localhost:3000';

const doctor = {
    userId: "dr_test_" + Date.now(),
    password: "password123",
    name: "Dr. Test",
    role: "doctor",
    phone: null,
    hospital: "General Hospital" // As hardcoded in app.js
};

async function runTest() {
    console.log("Testing Doctor Registration...");
    try {
        const res = await axios.post(`${API_URL}/register`, doctor);
        console.log("✅ Success:", res.data);
    } catch (err) {
        console.error("❌ Failed:", err.message);
        if (err.response) {
            console.error("Response Data:", err.response.data);
        }
    }
}

runTest();
