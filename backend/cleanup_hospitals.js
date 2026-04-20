const mongoose = require('mongoose');
const Hospital = require('./models/Hospital');

const MONGO_URI = "mongodb://127.0.0.1:27017/ehr_db";

const hospitalsToKeep = [
    /Andhra/i,
    /Ayush/i,
    /Asram/i,
    /Blossoms/i,
    /Siri/i,
    /Government General Hospital/i
];

async function cleanupHospitals() {
    await mongoose.connect(MONGO_URI);
    try {
        const allHospitals = await Hospital.find();
        console.log(`Initial hospital count: ${allHospitals.length}`);

        const hospitalsToDelete = allHospitals.filter(h => {
            const keep = hospitalsToKeep.some(pattern => pattern.test(h.hospitalName));
            return !keep;
        });

        console.log(`Hospitals to delete: ${hospitalsToDelete.length}`);
        for (const h of hospitalsToDelete) {
            console.log(`- Deleting: ${h.hospitalName}`);
            await Hospital.deleteOne({ _id: h._id });
        }

        const remaining = await Hospital.find();
        console.log(`\nRemaining hospitals (${remaining.length}):`);
        remaining.forEach(h => console.log(`- ${h.hospitalName} (${h.hospitalId})`));

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

cleanupHospitals();
