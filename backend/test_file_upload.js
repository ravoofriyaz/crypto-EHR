const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const API_URL = 'http://localhost:3000';

async function runTest() {
    try {
        console.log("1. Registering Patient...");
        const patientId = "PATIENT_" + Date.now();
        await axios.post(`${API_URL}/register`, {
            userId: patientId,
            name: "Test Patient",
            phone: "1234567890",
            password: "password123",
            role: "patient"
        });

        console.log("2. Registering Doctor...");
        const doctorId = "DOCTOR_" + Date.now();
        await axios.post(`${API_URL}/register`, {
            userId: doctorId,
            name: "Test Doctor",
            phone: "0987654321",
            password: "password123",
            role: "doctor",
            hospital: "Test Hospital"
        });

        console.log("3. Creating Dummy File...");
        const filePath = path.join(__dirname, 'test_report.txt'); // Using txt for simplicity, logic is same
        fs.writeFileSync(filePath, "This is a confidential medical report content.");

        console.log("4. Uploading Record with File...");
        const form = new FormData();
        form.append('patientId', patientId);
        form.append('disease', 'Test Disease');
        form.append('reason', 'Checkup');
        form.append('medicines', 'Pills');
        form.append('precautions', 'Rest');
        form.append('file', fs.createReadStream(filePath));

        const uploadRes = await axios.post(`${API_URL}/addRecord`, form, {
            headers: form.getHeaders()
        });
        console.log("Upload Response:", uploadRes.data);

        console.log("5. Granting Access...");
        await axios.post(`${API_URL}/grantAccess`, {
            patientId: patientId,
            doctorId: doctorId
        });

        console.log("6. Fetching Records as Doctor...");
        const recordsRes = await axios.get(`${API_URL}/getRecords/${patientId}/${doctorId}`);
        const records = recordsRes.data;
        console.log(`Found ${records.length} records.`);

        const record = records[0];
        if (record.file && record.file.hasFile) {
            console.log("Record has file metadata:", record.file);

            console.log("7. Downloading File...");
            const fileRes = await axios.get(`${API_URL}/getFile/${record._id}?requesterId=${doctorId}`, {
                responseType: 'arraybuffer'
            });

            const downloadedContent = fileRes.data.toString();
            console.log("Downloaded Content:", downloadedContent);

            if (downloadedContent === "This is a confidential medical report content.") {
                console.log("SUCCESS: File decrypted correctly!");
            } else {
                console.error("FAILURE: File content mismatch.");
            }

        } else {
            console.error("FAILURE: Record missing file metadata.");
        }

        // Cleanup
        fs.unlinkSync(filePath);

    } catch (error) {
        console.error("Test Failed:", error.response ? error.response.data : error.message);
    }
}

runTest();
