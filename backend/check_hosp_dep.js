const mongoose = require('mongoose');
const Hospital = require('./models/Hospital');

const MONGO_URI = "mongodb://127.0.0.1:27017/ehr_db";

async function checkHosp() {
    await mongoose.connect(MONGO_URI);
    try {
        const h = await Hospital.findOne({ hospitalId: 'HOSP012' });
        console.log(`Hospital Found: ${h.hospitalName}`);
        console.log(`Departments: ${JSON.stringify(h.departments)}`);
    } finally {
        await mongoose.disconnect();
    }
}

checkHosp();
