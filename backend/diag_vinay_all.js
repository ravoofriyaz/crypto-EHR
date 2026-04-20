const mongoose = require('mongoose');
const User = require('./models/User');
const Appointment = require('./models/Appointment');

const MONGO_URI = "mongodb://127.0.0.1:27017/ehr_db";

async function diag() {
    await mongoose.connect(MONGO_URI);
    try {
        const doc = await User.findOne({ name: /vinay/i, role: 'doctor' });
        console.log(`Doctor: ${doc.name} (${doc.userIdHash})`);

        const appts = await Appointment.find({ doctorId: doc.userIdHash });
        console.log(`Total appointments for Dr. Vinay: ${appts.length}`);
        appts.forEach(a => {
            console.log(`- Patient: ${a.patientName}, Date: "${a.appointmentDate}", Time: "${a.timeSlot}", Status: "${a.status}"`);
        });
    } finally {
        await mongoose.disconnect();
    }
}
diag();
