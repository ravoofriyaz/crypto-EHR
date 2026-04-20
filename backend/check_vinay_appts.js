const mongoose = require('mongoose');
const User = require('./models/User');
const Appointment = require('./models/Appointment');
const crypto = require('crypto');

const MONGO_URI = "mongodb://127.0.0.1:27017/ehr_db";

function hashId(id) {
    return crypto.createHash('sha256').update(id).digest('hex');
}

async function checkVinayAppointments() {
    await mongoose.connect(MONGO_URI);
    try {
        const vinay = await User.findOne({ name: /vinay/i, role: 'doctor' });
        if (!vinay) {
            console.log("Dr. Vinay not found.");
            return;
        }
        console.log(`Checking appointments for ${vinay.name} (Hash: ${vinay.userIdHash})`);

        const appointments = await Appointment.find({ doctorId: vinay.userIdHash });
        console.log(`Found ${appointments.length} appointments in DB with matching doctorId Hash.`);

        appointments.forEach(a => {
            console.log(`- Patient: ${a.patientName}, Date: ${a.appointmentDate}, Time: ${a.timeSlot}, Status: ${a.status}`);
        });

        const allAppointments = await Appointment.find({ doctorName: /vinay/i });
        console.log(`Found ${allAppointments.length} appointments with name 'Vinay'.`);
        allAppointments.forEach(a => {
            if (a.doctorId !== vinay.userIdHash) {
                console.log(`!!! MISMATCH: Appointment doctorId ${a.doctorId} does not match User hash ${vinay.userIdHash}`);
            }
        });

    } finally {
        await mongoose.disconnect();
    }
}

checkVinayAppointments();
