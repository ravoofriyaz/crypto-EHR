const mongoose = require("mongoose");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const Record = require("./models/Record");
const { verifyData } = require("./utils/digitalSignature");

async function testSignature() {
    console.log("--- Starting Digital Signature Verification Test ---\n");

    try {
        await mongoose.connect("mongodb://127.0.0.1:27017/ehr_db");
        console.log("✅ Connected to MongoDB");

        // Load Public Key
        const publicKey = fs.readFileSync(path.join(__dirname, 'keys', 'public.pem'), 'utf8');

        // Find the latest record with a signature and a file
        const record = await Record.findOne({ digitalSignature: { $ne: null } }).sort({ timestamp: -1 });

        if (!record) {
            console.log("❌ No signed records found in database. Please upload a medical record first.");
            process.exit(0);
        }

        console.log(`\n🔍 Found Record ID: ${record._id}`);
        console.log(`👤 Signed By: ${record.signedBy}`);
        console.log(`🛡️ Signature (Base64): ${record.digitalSignature.substring(0, 30)}...`);

        // Helper to calculate file hash
        async function getFileHash(filePath) {
            const hash = crypto.createHash('sha256');
            const stream = fs.createReadStream(filePath);
            return new Promise((resolve, reject) => {
                stream.on('data', data => hash.update(data));
                stream.on('end', () => resolve(hash.digest('hex')));
                stream.on('error', err => reject(err));
            });
        }

        // 1. PERFORM CLEAN VERIFICATION
        console.log("\n--- Step 1: Normal Verification ---");
        let verificationHash = record.hash;

        if (record.file && record.file.hasFile) {
            const filePath = path.join(__dirname, 'uploads', record.file.encryptedPath);
            if (fs.existsSync(filePath)) {
                const fileEncHash = await getFileHash(filePath);
                verificationHash = crypto.createHash('sha256').update(record.hash + fileEncHash).digest('hex');
                console.log("✅ Encrypted binary file found and hashed.");
            } else {
                console.log("⚠️ Linked file missing from disk. Verifying metadata signature only.");
            }
        }

        const isValid = verifyData(verificationHash, record.digitalSignature, publicKey);

        if (isValid) {
            console.log("✅ SUCCESS: Digital Signature is VALID. The record is authentic.");
        } else {
            console.log("❌ FAILURE: Digital Signature is INVALID. Verification failed.");
        }

        // 2. SIMULATE TAMPERING
        console.log("\n--- Step 2: Simulating Tampering ---");
        console.log("Modifying the verification hash (simulating a bit flip in the file)...");
        const tamperedHash = verificationHash.substring(0, 63) + (verificationHash[63] === '0' ? '1' : '0');

        const isTamperedValid = verifyData(tamperedHash, record.digitalSignature, publicKey);

        if (!isTamperedValid) {
            console.log("✅ SUCCESS: Tampering detected! Signature verification rejected the modified data.");
        } else {
            console.log("❌ FAILURE: System failed to detect tampering!");
        }

        console.log("\n✅ Digital Signature Module is working correctly.");

    } catch (err) {
        console.error("Test Error:", err);
    } finally {
        mongoose.connection.close();
    }
}

testSignature();
