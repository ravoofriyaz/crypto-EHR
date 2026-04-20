const mongoose = require('mongoose');
const User = require('./models/User');

const MONGO_URI = "mongodb://127.0.0.1:27017/ehr_db";

async function cleanup() {
    try {
        await mongoose.connect(MONGO_URI);
        const docs = await User.find({ role: 'doctor' });

        const specMap = {};
        docs.forEach(d => {
            const s = d.specialist || d.specialization || d.department;
            if (!specMap[s]) specMap[s] = [];
            specMap[s].push({
                name: d.name,
                idHash: d.userIdHash,
                id: d.userIdEnc // Might be able to guess from name
            });
        });

        // Newly added IDs (from my recent seed)
        const myAddedNames = [
            'Suresh', 'Mani', 'Kamal', 'Vinay', 'Surya',
            'Ravi', 'Rajesh', 'Amit', 'Vikram', 'Sunil',
            'Anil', 'Varun', 'Karan', 'Rahul', 'Sameer',
            'Ajay', 'Vijay', 'Deepak', 'Manoj', 'Rohit',
            'Sandeep', 'Vikas', 'Pankaj', 'Nitin', 'Arun',
            'Pradeep', 'Kishan', 'Gopal', 'Madan', 'Shiva'
        ];

        console.log("Analyzing specializations...");

        for (const spec in specMap) {
            const specialists = specMap[spec];
            if (specialists.length > 1) {
                console.log(`Spec [${spec}] has ${specialists.length} doctors. Cleaning up...`);
                // Find and remove the one I added
                for (const s of specialists) {
                    if (myAddedNames.includes(s.name)) {
                        console.log(`  -> Removing newly added doctor: ${s.name} from ${spec}`);
                        await User.deleteOne({ userIdHash: s.idHash });
                    }
                }
            } else {
                console.log(`Spec [${spec}] has 1 doctor: ${specialists[0].name}. Keeping.`);
            }
        }

        const finalCount = await User.countDocuments({ role: 'doctor' });
        console.log(`\nFinal Doctor Count: ${finalCount}`);
        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}

cleanup();
