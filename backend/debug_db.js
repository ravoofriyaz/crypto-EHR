const mongoose = require("mongoose");
const User = require("./models/User");
const Record = require("./models/Record");
require("dotenv").config();
require("./db");

async function checkData() {
    try {
        const users = await User.find({});
        console.log("--- User Data ---");
        users.forEach(u => {
            console.log(`ID: ${u.userIdHash.substring(0, 8)} | Role: ${u.role} | HospId: ${u.hospitalId} | Visits: ${u.hospitalsVisited.length}`);
        });

        const records = await Record.find({});
        console.log("\n--- Record Data ---");
        records.forEach(r => {
            console.log(`Record ID: ${r._id} | Patient: ${r.patientId.substring(0, 8)} | Hospital: ${r.hospitalId}`);
        });

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkData();
