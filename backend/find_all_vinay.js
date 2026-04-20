const mongoose = require('mongoose');
const User = require('./models/User');

const MONGO_URI = "mongodb://127.0.0.1:27017/ehr_db";

async function findAllVinay() {
    await mongoose.connect(MONGO_URI);
    try {
        const doctors = await User.find({ name: /vinay/i, role: 'doctor' });
        console.log(`Found ${doctors.length} Vinays`);
        doctors.forEach(d => {
            console.log(`- Doctor: ${d.name}, Hosp: ${d.hospitalName}, HospID: ${d.hospitalId}, Dept: ${d.department}`);
        });
    } finally {
        await mongoose.disconnect();
    }
}

findAllVinay();
