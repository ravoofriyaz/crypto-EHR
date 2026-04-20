const mongoose = require('mongoose');
const axios = require('axios');
const Record = require('./models/Record');

// Connect to DB directly to inspect raw data
mongoose.connect('mongodb://localhost:27017/ehr_db').then(() => console.log("Connected to MongoDB for Verification"));

const API_URL = 'http://localhost:3000';

async function run() {
    try {
        // 1. Reset DB via API
        console.log("1. Resetting DB...");
        try {
            await axios.post(`${API_URL}/reset`);
        } catch (e) {
            console.log("Reset failed (server might be down?), manually clearing collection");
            await Record.deleteMany({});
        }

        // 2. Register Patient
        console.log("2. Registering Patient...");
        const patientId = "SCHEMA_TEST_" + Date.now();
        await axios.post(`${API_URL}/register`, {
            userId: patientId,
            name: "Schema Test Patient",
            phone: "0000000000",
            password: "password",
            role: "patient"
        });

        // 3. Add Record
        console.log("3. Adding Record...");
        await axios.post(`${API_URL}/addRecord`, {
            patientId: patientId,
            disease: "Secret Disease",
            reason: "Secret Reason",
            medicines: "Secret Meds",
            precautions: "Secret Precautions"
        });

        // 4. Inspect Raw MongoDB Document
        console.log("4. Inspecting Raw MongoDB Document...");
        // Wait a bit for async partial writes? (Shouldn't differ but just in case)
        await new Promise(r => setTimeout(r, 1000));

        const rawRecord = await Record.findOne({}).sort({ timestamp: -1 });

        console.log("\n--- RAW MONGODB DOCUMENT ---");
        console.log(JSON.stringify(rawRecord.toObject(), null, 2));
        console.log("----------------------------\n");

        if (rawRecord.disease && !rawRecord.encryptedData) {
            console.log("SUCCESS: Schema is correct (Field Level Encryption)");
        } else if (rawRecord.encryptedData) {
            console.log("FAILURE: Schema is OLD (Encrypted Blob)");
        } else {
            console.log("FAILURE: Unknown Schema state");
        }

    } catch (err) {
        console.error("Verification Error:", err.message);
        if (err.response) console.error("API Response:", err.response.data);
    } finally {
        mongoose.connection.close();
    }
}

// Give server a moment to start if run immediately after
setTimeout(run, 2000);
