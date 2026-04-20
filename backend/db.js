const mongoose = require("mongoose");

mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/ehr_db");

mongoose.connection.once("open", () => {
  console.log("MongoDB connected");
});
