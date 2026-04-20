const mongoose = require('mongoose');
const Appointment = require('./models/Appointment');

const MONGO_URI = "mongodb://127.0.0.1:27017/ehr_db";

async function diag() {
    await mongoose.connect(MONGO_URI);
    try {
        const appts = await Appointment.find({ doctorName: /vinay/i });
        appts.forEach(a => {
            console.log(`Appointment: ${a.patientName} | Date: ${a.appointmentDate} | Status: ${a.status}`);
        });
    } finally {
        await mongoose.disconnect();
    }
}
diag();
