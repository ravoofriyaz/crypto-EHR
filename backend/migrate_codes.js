const mongoose = require('mongoose');
const Appointment = require('./models/Appointment');

async function migrate() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/ehr_db');
        const appts = await Appointment.find({ status: 'Approved', visitCode: null });
        console.log(`Found ${appts.length} appointments to migrate.`);

        for (let a of appts) {
            const prefix = a.hospitalId ? a.hospitalId.substring(0, 3).toUpperCase() : 'VIS';
            const code = Math.floor(100000 + Math.random() * 900000).toString();
            a.visitCode = `${prefix}-${code}`;
            a.visitCodeExpiry = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours
            a.visitCodeUsed = false;
            await a.save();
            console.log(`Updated Appointment ${a._id} with code: ${a.visitCode}`);
        }
        console.log('Migration complete.');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

migrate();
