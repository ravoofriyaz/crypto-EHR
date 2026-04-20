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
        const patientId = "pat_real_" + Date.now();
        const doctorId = "doc_real_" + Date.now();

        // 1. Register & Check Wallet logic
        console.log("Registering Users (Expecting Real Wallets assigned by Server)...");
        await request('/register', 'POST', JSON.stringify({ userId: patientId, password: "pw", role: "patient" }));
        await request('/register', 'POST', JSON.stringify({ userId: doctorId, password: "pw", role: "doctor" }));

        // 2. Login to get wallet and verify it's not a mock one
        // Mock wallets were random hex. Real ganache wallets are usually in the list of 10.
        // We can check this by trying a transaction.

        console.log("Adding Record (Should trigger REAL blockchain transaction)...");
        // addRecord endpoint will fetch user from DB (who now has real wallet) and try blockchain.addRecord
        const resAdd = await request('/addRecord', 'POST', JSON.stringify({
            patientId: patientId, disease: "RealChain Flu", reason: "Testing", precautions: "None", medicines: "None", filePath: "None"
        }));
        console.log("Add Record Response:", resAdd.body);

        console.log("Granting Access (Should trigger REAL blockchain transaction)...");
        const resGrant = await request('/grantAccess', 'POST', JSON.stringify({ patientId, doctorId }));
        console.log("Grant Access Response:", resGrant.body);

    } catch (err) {
        console.error("Test Error:", err);
    }
}

run();
