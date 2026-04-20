const mongoose = require('mongoose');

// Connect to MongoDB using 127.0.0.1
mongoose.connect('mongodb://127.0.0.1:27017/ehr_db').then(async () => {
    console.log("Connected to MongoDB...");
    try {
        await mongoose.connection.dropDatabase();
        console.log("✅ Database dropped successfully!");
        process.exit(0);
    } catch (err) {
        console.error("Error dropping DB:", err);
        process.exit(1);
    }
}).catch(err => {
    console.error("Connection Error:", err);
    process.exit(1);
});
