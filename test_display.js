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
        const patientId = "pat_display_" + Date.now();
        const doctorId = "doc_display_" + Date.now();

        // Register
        await request('/register', 'POST', JSON.stringify({ userId: patientId, password: "pw", role: "patient", wallet: "0x" + Array(40).fill('0').join('') }));
        await request('/register', 'POST', JSON.stringify({ userId: doctorId, password: "pw", role: "doctor", wallet: "0x" + Array(40).fill('0').join('') }));

        // Add Record
        await request('/addRecord', 'POST', JSON.stringify({
            patientId: patientId, disease: "Flu", reason: "Viral", precautions: "Rest", medicines: "Meds", filePath: "None"
        }));

        // Grant Access
        await request('/grantAccess', 'POST', JSON.stringify({ patientId, doctorId }));

        // Fetch
        const res = await request(`/getRecords/${patientId}/${doctorId}`, 'GET');
        console.log("Response Body (Check for timestamp number and disease field):");
        console.log(res.body);

        const records = JSON.parse(res.body);
        if (records.length > 0) {
            console.log("\nFirst Record Timestamp type:", typeof records[0].timestamp);
            console.log("First Record Disease:", records[0].disease);
        }

    } catch (err) {
        console.error("Test Error:", err);
    }
}

run();
