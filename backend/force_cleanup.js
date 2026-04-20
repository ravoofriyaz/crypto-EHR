const mongoose = require("mongoose");
const Access = require("./models/Access");
const crypto = require("crypto");

const MONGO_URI = "mongodb://127.0.0.1:27017/ehr_db";

function hashId(id) {
    if (!id) return "";
    return crypto.createHash("sha256").update(id).digest("hex");
}

async function debugAccess() {
    try {
        await mongoose.connect(MONGO_URI);
        const allAccess = await Access.find({});
        console.log("Current Access records in DB:");
        allAccess.forEach(acc => {
            console.log(`- ID: ${acc._id}`);
            console.log(`  DoctorID (Hash): ${acc.doctorId}`);
            console.log(`  PatientID (Hash): ${acc.patientId}`);
            console.log(`  ExpiresAt: ${acc.expiresAt}`);
            console.log(`  Current Date: ${new Date()}`);
            console.log(`  Is Expired: ${acc.expiresAt && new Date() > acc.expiresAt}`);
        });

        // Force delete everything with expiresAt in the past
        const deleted = await Access.deleteMany({
            expiresAt: { $ne: null, $lt: new Date() }
        });
        console.log(`\nDeleted ${deleted.deletedCount} expired access records.`);

        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}

debugAccess();
