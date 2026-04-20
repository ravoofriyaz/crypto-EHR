const mongoose = require('mongoose');
const User = require('./models/User');

const MONGO_URI = "mongodb://127.0.0.1:27017/ehr_db";

async function verify() {
    try {
        await mongoose.connect(MONGO_URI);
        const docs = await User.find({ role: 'doctor' });
        const specMap = {};
        docs.forEach(d => {
            const s = d.specialist || d.specialization || d.department;
            if (!specMap[s]) specMap[s] = [];
            specMap[s].push(d.name);
        });

        console.log("FINAL STATE PER SPECIFICATION:");
        for (const spec in specMap) {
            console.log(`${spec}: ${specMap[spec].join(', ')}`);
        }
        console.log(`\nTotal Doctors: ${docs.length}`);
        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}

verify();
