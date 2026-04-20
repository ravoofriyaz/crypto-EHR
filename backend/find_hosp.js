const mongoose = require('mongoose');
const Hospital = require('./models/Hospital');

const MONGO_URI = "mongodb://127.0.0.1:27017/ehr_db";

async function findHospital() {
    await mongoose.connect(MONGO_URI);
    try {
        const results = await Hospital.find({ hospitalName: /Blossoms/i });
        console.log("Check Output Start");
        results.forEach(h => {
            console.log(`Hospital: ${h.hospitalName}`);
            console.log(`- hospitalId: ${h.hospitalId}`);
        });
        console.log("Check Output End");
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

findHospital();
