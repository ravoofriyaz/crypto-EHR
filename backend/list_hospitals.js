const mongoose = require('mongoose');
const Hospital = require('./models/Hospital');

const MONGO_URI = "mongodb://127.0.0.1:27017/ehr_db";

async function listHospitals() {
    await mongoose.connect(MONGO_URI);
    try {
        const hospitals = await Hospital.find();
        hospitals.forEach(h => {
            console.log(`Hospital: '${h.hospitalName}', ID: '${h.hospitalId}'`);
        });
    } finally {
        await mongoose.disconnect();
    }
}

listHospitals();
