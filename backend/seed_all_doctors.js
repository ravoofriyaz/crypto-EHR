const mongoose = require('mongoose');
const User = require('./models/User');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const fs = require('fs');
const path = require('path');

const MONGO_URI = "mongodb://127.0.0.1:27017/ehr_db";
const publicKeyPath = path.join(__dirname, 'keys', 'public.pem');
const publicKey = fs.readFileSync(publicKeyPath, 'utf8');

function hashId(id) {
    return crypto.createHash('sha256').update(id).digest('hex');
}

function encryptId(id) {
    return crypto.publicEncrypt(
        { key: publicKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" },
        Buffer.from(id)
    ).toString('base64');
}

const doctorData = [
    // Andhra Hospitals (HOSP001)
    { id: 'suresh', name: 'Suresh', hospId: 'HOSP001', hospName: 'Andhra Hospitals', spec: 'Cardiology' },
    { id: 'mani', name: 'Mani', hospId: 'HOSP001', hospName: 'Andhra Hospitals', spec: 'Neurology' },
    { id: 'kamal', name: 'Kamal', hospId: 'HOSP001', hospName: 'Andhra Hospitals', spec: 'Gastroenterology' },
    { id: 'vinay', name: 'Vinay', hospId: 'HOSP001', hospName: 'Andhra Hospitals', spec: 'Pulmonology' },
    { id: 'surya', name: 'Surya', hospId: 'HOSP001', hospName: 'Andhra Hospitals', spec: 'General Medicine' },

    // Aayush Hospitals (HOSP002)
    { id: 'ravi', name: 'Ravi', hospId: 'HOSP002', hospName: 'Aayush Hospitals', spec: 'General Surgery' },
    { id: 'rajesh', name: 'Rajesh', hospId: 'HOSP002', hospName: 'Aayush Hospitals', spec: 'Orthopedics' },
    { id: 'amit', name: 'Amit', hospId: 'HOSP002', hospName: 'Aayush Hospitals', spec: 'Dermatology' },
    { id: 'vikram', name: 'Vikram', hospId: 'HOSP002', hospName: 'Aayush Hospitals', spec: 'ENT (Otolaryngology)' },
    { id: 'sunil', name: 'Sunil', hospId: 'HOSP002', hospName: 'Aayush Hospitals', spec: 'Urology' },

    // Asram (HOSP003)
    { id: 'anil', name: 'Anil', hospId: 'HOSP003', hospName: 'Asram Hospital', spec: 'Oncology' },
    { id: 'varun', name: 'Varun', hospId: 'HOSP003', hospName: 'Asram Hospital', spec: 'Nephrology' },
    { id: 'karan', name: 'Karan', hospId: 'HOSP003', hospName: 'Asram Hospital', spec: 'Cardiothoracic Surgery' },
    { id: 'rahul', name: 'Rahul', hospId: 'HOSP003', hospName: 'Asram Hospital', spec: 'Neurosurgery' },
    { id: 'sameer', name: 'Sameer', hospId: 'HOSP003', hospName: 'Asram Hospital', spec: 'Critical Care Medicine' },

    // Siri (HOSP004)
    { id: 'ajay', name: 'Ajay', hospId: 'HOSP004', hospName: 'Siri Super Speciality', spec: 'Endocrinology' },
    { id: 'vijay', name: 'Vijay', hospId: 'HOSP004', hospName: 'Siri Super Speciality', spec: 'Rheumatology' },
    { id: 'deepak', name: 'Deepak', hospId: 'HOSP004', hospName: 'Siri Super Speciality', spec: 'Plastic Surgery' },
    { id: 'manoj', name: 'Manoj', hospId: 'HOSP004', hospName: 'Siri Super Speciality', spec: 'Anesthesiology' },
    { id: 'rohit', name: 'Rohit', hospId: 'HOSP004', hospName: 'Siri Super Speciality', spec: 'Radiology' },

    // Blossoms (HOSP005)
    { id: 'sandeep', name: 'Sandeep', hospId: 'HOSP005', hospName: 'Blossoms Children Hospital', spec: 'Pediatrics' },
    { id: 'vikas', name: 'Vikas', hospId: 'HOSP005', hospName: 'Blossoms Children Hospital', spec: 'Neonatology' },
    { id: 'pankaj', name: 'Pankaj', hospId: 'HOSP005', hospName: 'Blossoms Children Hospital', spec: 'Pediatric Cardiology' },
    { id: 'nitin', name: 'Nitin', hospId: 'HOSP005', hospName: 'Blossoms Children Hospital', spec: 'Pediatric Neurology' },
    { id: 'arun', name: 'Arun', hospId: 'HOSP005', hospName: 'Blossoms Children Hospital', spec: 'Pediatric Pulmonology' },

    // Government (HOSP017)
    { id: 'pradeep', name: 'Pradeep', hospId: 'HOSP017', hospName: 'Government General Hospital', spec: 'Emergency Medicine' },
    { id: 'kishan', name: 'Kishan', hospId: 'HOSP017', hospName: 'Government General Hospital', spec: 'Gynecology & Obstetrics' },
    { id: 'gopal', name: 'Gopal', hospId: 'HOSP017', hospName: 'Government General Hospital', spec: 'Psychiatry' },
    { id: 'madan', name: 'Madan', hospId: 'HOSP017', hospName: 'Government General Hospital', spec: 'Hematology' },
    { id: 'shiva', name: 'Shiva', hospId: 'HOSP017', hospName: 'Government General Hospital', spec: 'Ophthalmology' }
];

async function seed() {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB for Seeding Doctors...");

    try {
        for (const d of doctorData) {
            const userIdHash = hashId(d.id);
            const userIdEnc = encryptId(d.id);
            const hashedPassword = await bcrypt.hash(d.id, 10); // ID and Password are same

            await User.findOneAndUpdate(
                { userIdHash },
                {
                    userIdHash,
                    userIdEnc,
                    name: d.name,
                    role: 'doctor',
                    hospitalId: d.hospId,
                    hospitalName: d.hospName,
                    specialist: d.spec,
                    department: d.spec,
                    specialization: d.spec, // Added for redundancy
                    experienceYears: 10,
                    password: hashedPassword,
                    phone: "+911234567890" // Placeholder phone
                },
                { upsert: true, new: true }
            );
            console.log(`Seeded: ${d.spec} -> ID: ${d.id}`);
        }
        console.log("\nAll 30 specializations now have a dedicated doctor account.");
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

seed();
