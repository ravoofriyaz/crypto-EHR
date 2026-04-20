const mongoose = require('mongoose');
const Hospital = require('./models/Hospital');

const MONGO_URI = "mongodb://127.0.0.1:27017/ehr_db";

const hospitalData = [
    {
        name: /Andhra/i,
        specializations: ["Cardiology", "Neurology", "Gastroenterology", "Pulmonology", "General Medicine"]
    },
    {
        name: /Aayush/i,
        specializations: ["General Surgery", "Orthopedics", "Dermatology", "ENT (Otolaryngology)", "Urology"]
    },
    {
        name: /Asram/i,
        specializations: ["Oncology", "Nephrology", "Cardiothoracic Surgery", "Neurosurgery", "Critical Care Medicine"]
    },
    {
        name: /Siri/i,
        specializations: ["Endocrinology", "Rheumatology", "Plastic Surgery", "Anesthesiology", "Radiology"]
    },
    {
        name: /Blossoms/i,
        specializations: ["Pediatrics", "Neonatology", "Pediatric Neurology", "Pediatric Pulmonology"]
    },
    {
        name: /Government General Hospital/i,
        specializations: ["Emergency Medicine", "Gynecology & Obstetrics", "Psychiatry", "Hematology", "Ophthalmology"]
    }
];

async function migrate() {
    await mongoose.connect(MONGO_URI);
    try {
        for (const data of hospitalData) {
            const h = await Hospital.findOne({ hospitalName: data.name });
            if (h) {
                console.log(`Updating ${h.hospitalName}...`);
                // Use the new field name
                h.specializations = data.specializations;
                // Delete the old field if it exists (Optional, but clean)
                h.set('departments', undefined);
                await h.save();
                console.log(`- Updated with ${data.specializations.length} specializations.`);
            } else {
                console.log(`!!! Hospital matching ${data.name} NOT found.`);
            }
        }
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

migrate();
