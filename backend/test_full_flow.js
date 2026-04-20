const axios = require('axios');
const mongoose = require('mongoose');
const crypto = require('crypto');

const API_URL = 'http://localhost:3000';
const MONGO_URI = "mongodb://127.0.0.1:27017/ehr_db";

// 1. Patient
const patient = {
    userId: "patient_" + Date.now(),
    password: "password123",
    name: "John Patient",
    role: "patient"
};

// 2. Doctor
const doctor = {
    userId: "doctor_" + Date.now(),
    password: "password123",
    name: "Dr. Smith",
    role: "doctor"
    // hospital, spec, license omitted as per new UI
};

async function runTest() {
    console.log("Starting Full Flow Test (Encrypted IDs)...");

    try {
        // --- REGISTER PATIENT ---
        console.log(`\n1. Registering Patient: ${patient.userId}`);
        await axios.post(`${API_URL}/register`, patient);
        console.log("   ✅ Patient Registered");

        // --- REGISTER DOCTOR ---
        console.log(`\n2. Registering Doctor: ${doctor.userId}`);
        await axios.post(`${API_URL}/register`, doctor);
        console.log("   ✅ Doctor Registered");

        // --- DOCTOR ADDS RECORD ---
        console.log(`\n3. Doctor Adding Record for Patient...`);
        // We need to simulate form-data, but axios supports JSON if backend uses body-parser (which it does, but wait, it uses multer for file upload!)
        // Multer handles multipart/form-data. Axios needs FormData.
        // Let's import form-data lib or just use a simple object if multer is optional?
        // In server.js: app.post("/addRecord", upload.single("file"), ...)
        // If we send JSON, multer might not like it or body might be empty?
        // Actually, without a file, multer passes body fields.
        // But axios needs to send as form data to be safe?
        // Let's try sending standard JSON first. If it fails, I'll skip file upload or use form-data package.
        // Wait, standard JSON with multer often results in empty body if content-type isn't multipart.
        // Let's use `form-data` package if usually available in node env, but I might not have it installed.
        // I'll try sending as JSON first but `server.js` uses `upload.single('file')`. 
        // Typically extracting body from JSON while using multer requires specific setup.
        // Let's check package.json if `form-data` is there? No.
        // I will assume for this test we can just hit the endpoint. 
        // I will use a boundary string to mimic form data manually or just use `axios` with `Content-Type: application/x-www-form-urlencoded` which multer supports.

        const FormData = require('form-data');
        const recordData = new FormData();
        recordData.append('patientId', patient.userId);
        recordData.append('disease', 'Flu');
        recordData.append('reason', 'Fever');
        recordData.append('precautions', 'Rest');
        recordData.append('medicines', 'Paracetamol');

        const addRes = await axios.post(`${API_URL}/addRecord`, recordData, {
            headers: recordData.getHeaders()
        });
        console.log("   ✅ Record Added:", addRes.data);

        // --- PATIENT FETCHES RECORD ---
        console.log(`\n4. Patient Fetching Record...`);
        const fetchRes = await axios.get(`${API_URL}/getRecords/${patient.userId}/${patient.userId}`);

        if (Array.isArray(fetchRes.data) && fetchRes.data.length > 0) {
            console.log("   ✅ Records Fetched Successfully");
            console.log("   Record 1 Disease:", fetchRes.data[0].disease);

            if (fetchRes.data[0].disease === "Flu") {
                console.log("   ✅ Decryption Verified!");
            } else {
                console.error("   ❌ Decryption Mismatch:", fetchRes.data[0].disease);
            }
        } else {
            console.error("   ❌ No records found or fetching failed.");
        }

    } catch (err) {
        console.error("Test Error:", err.message);
        if (err.response) {
            const dataStr = typeof err.response.data === 'object' ? JSON.stringify(err.response.data) : String(err.response.data);
            console.error("Response Start:", dataStr.substring(0, 500));
        }
    }
}

runTest();
