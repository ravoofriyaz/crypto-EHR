const mongoose = require('mongoose');
const User = require('./models/User');

const MONGO_URI = "mongodb://127.0.0.1:27017/ehr_db";

async function testFetch() {
    await mongoose.connect(MONGO_URI);
    try {
        const hospitalId = 'HOSP012';
        const department = 'Pediatrics';

        console.log(`Searching for Role: doctor, Hospital: '${hospitalId}', Dept: '${department}'`);

        const doctors = await User.find({
            role: 'doctor',
            hospitalId: hospitalId,
            department: department
        });

        console.log(`Found ${doctors.length} doctors.`);
        doctors.forEach(d => {
            console.log(`- Doctor Name: '${d.name}', Dept: '${d.department}', Specialist: '${d.specialist}'`);
            // Check for hidden characters
            console.log(`- Dept buffer:`, Buffer.from(d.department || ""));
        });

        // Try loose match
        const loose = await User.find({
            role: 'doctor',
            hospitalId: hospitalId,
            department: /Pediatrics/i
        });
        console.log(`Found ${loose.length} doctors with loose match.`);

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

testFetch();
