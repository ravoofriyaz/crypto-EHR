const mongoose = require('mongoose');
const User = require('./models/User');

const MONGO_URI = "mongodb://127.0.0.1:27017/ehr_db";

async function listDoctors() {
    await mongoose.connect(MONGO_URI);
    try {
        const hospitalId = 'HOSP012';
        const doctors = await User.find({ role: 'doctor', hospitalId: hospitalId });
        console.log(`Found ${doctors.length} doctors for hospital HOSP012`);
        doctors.forEach(d => {
            console.log(`- Name: '${d.name}', Dept: '${d.department}', Specialist: '${d.specialist}'`);
        });
    } finally {
        await mongoose.disconnect();
    }
}

listDoctors();
