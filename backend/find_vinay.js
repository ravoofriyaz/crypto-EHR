const mongoose = require('mongoose');
const User = require('./models/User');

const MONGO_URI = "mongodb://127.0.0.1:27017/ehr_db";

async function findDoctor() {
    await mongoose.connect(MONGO_URI);
    try {
        const results = await User.find({ name: /Vinay/i });
        console.log("Check Output Start");
        results.forEach(d => {
            console.log(`Doctor: ${d.name}`);
            console.log(`- HospitalID: ${d.hospitalId}`);
            console.log(`- Specialist: ${d.specialist}`);
            console.log(`- Department: ${d.department}`);
        });
        console.log("Check Output End");
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

findDoctor();
