const mongoose = require('mongoose');
const User = require('./models/User');
const Appointment = require('./models/Appointment');

const MONGO_URI = "mongodb://127.0.0.1:27017/ehr_db";

async function diag() {
    await mongoose.connect(MONGO_URI);
    try {
        const doc = await User.findOne({ name: /vinay/i, role: 'doctor' });
        console.log(`Doctor Name: ${doc.name}`);
        console.log(`Doctor userIdHash: [${doc.userIdHash}]`);

        const appts = await Appointment.find({ doctorName: /vinay/i });
        console.log(`Appointments found for 'Vinay': ${appts.length}`);
        appts.forEach(a => {
            console.log(`Appointment Doc ID: [${a.doctorId}]`);
            console.log(`Match? ${a.doctorId === doc.userIdHash}`);
        });
    } finally {
        await mongoose.disconnect();
    }
}
diag();
