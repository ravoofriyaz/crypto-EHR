const http = require('http');

function request(path, method, data) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data ? Buffer.byteLength(data) : 0
            }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => resolve({ status: res.statusCode, body }));
        });

        req.on('error', (e) => reject(e));
        if (data) req.write(data);
        req.end();
    });
}

async function run() {
    try {
        const patientId = "patient_" + Date.now();
        const doctorId = "doctor_" + Date.now();

        // 1. Register Patient
        console.log("Registering Patient...");
        await request('/register', 'POST', JSON.stringify({
            userId: patientId, password: "pw", role: "patient", wallet: "0x" + Array(40).fill('0').join('')
        }));

        // 2. Register Doctor
        console.log("Registering Doctor...");
        await request('/register', 'POST', JSON.stringify({
            userId: doctorId, password: "pw", role: "doctor", wallet: "0x" + Array(40).fill('0').join('')
        }));

        // 3. Add Record
        console.log("Adding Record...");
        await request('/addRecord', 'POST', JSON.stringify({
            patientId: patientId, disease: "Flu", reason: "Viral", precautions: "Rest", medicines: "Meds", filePath: "None"
        }));

        // 4. Try Fetch (Should Fail)
        console.log("Fetching Records (Before Access)...");
        const res1 = await request(`/getRecords/${patientId}/${doctorId}`, 'GET');
        console.log(`Status (Expected 403): ${res1.status}`);

        // 5. Grant Access
        console.log("Granting Access...");
        const grantRes = await request('/grantAccess', 'POST', JSON.stringify({
            patientId: patientId, doctorId: doctorId
        }));
        console.log(`Grant Status: ${grantRes.status}`);

        // 6. Try Fetch (Should Success)
        console.log("Fetching Records (After Access)...");
        const res2 = await request(`/getRecords/${patientId}/${doctorId}`, 'GET');
        console.log(`Status (Expected 200): ${res2.status}`);
        console.log(`Body: ${res2.body}`);

    } catch (err) {
        console.error("Test Error:", err);
    }
}

run();
