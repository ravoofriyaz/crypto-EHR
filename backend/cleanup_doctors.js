const mongoose = require('mongoose');
const User = require('./models/User');
const crypto = require('crypto');

const MONGO_URI = "mongodb://127.0.0.1:27017/ehr_db";

function hashId(id) {
    return crypto.createHash('sha256').update(id).digest('hex');
}

const validIds = [
    'saikiran', 'venkatesh', 'adityavarma', 'harshateja', 'sriram',
    'rohitreddy', 'maheshbabu', 'nikhilkumar', 'praneeth', 'karthikeya',
    'sravani', 'harika', 'lakshmipriya', 'keerthana', 'anusha',
    'bhavya', 'deepika', 'nandini', 'meghana', 'siri',
    'akhil', 'charanteja', 'naveenkumar', 'pavankalyan', 'raghavendra',
    'suryaprakash', 'tarun', 'vivekreddy', 'yaswanth', 'chaitanya'
];

const validHashes = validIds.map(hashId);

async function cleanup() {
    await mongoose.connect(MONGO_URI);
    try {
        const result = await User.deleteMany({
            role: 'doctor',
            userIdHash: { $nin: validHashes }
        });
        console.log(`Successfully deleted ${result.deletedCount} old doctor accounts.`);
    } catch (err) {
        console.error("Cleanup Error:", err);
    } finally {
        await mongoose.disconnect();
    }
}

cleanup();
