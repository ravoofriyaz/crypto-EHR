const mongoose = require("mongoose");
const Hospital = require("./models/Hospital");
require("dotenv").config();
require("./db");

const hospitals = [
    {
        hospitalId: "HOSP001",
        hospitalName: "Andhra Hospitals",
        address: "Eluru",
        city: "Eluru",
        state: "Andhra Pradesh",
        contactNumber: "08812-111111",
        specializations: ["Cardiology", "Neurology", "Gastroenterology", "Pulmonology", "General Medicine"]
    },
    {
        hospitalId: "HOSP002",
        hospitalName: "Aayush Hospitals",
        address: "Vijayawada",
        city: "Vijayawada",
        state: "Andhra Pradesh",
        contactNumber: "0866-222222",
        specializations: ["General Surgery", "Orthopedics", "Dermatology", "ENT (Otolaryngology)", "Urology"]
    },
    {
        hospitalId: "HOSP003",
        hospitalName: "Asram Hospital",
        address: "Eluru",
        city: "Eluru",
        state: "Andhra Pradesh",
        contactNumber: "08812-333333",
        specializations: ["Oncology", "Nephrology", "Cardiothoracic Surgery", "Neurosurgery", "Critical Care Medicine"]
    },
    {
        hospitalId: "HOSP004",
        hospitalName: "Siri Super Speciality",
        address: "Eluru",
        city: "Eluru",
        state: "Andhra Pradesh",
        contactNumber: "08812-444444",
        specializations: ["Endocrinology", "Rheumatology", "Plastic Surgery", "Anesthesiology", "Radiology"]
    },
    {
        hospitalId: "HOSP005",
        hospitalName: "Blossoms Children Hospital",
        address: "Eluru",
        city: "Eluru",
        state: "Andhra Pradesh",
        contactNumber: "08812-555555",
        specializations: ["Pediatrics", "Neonatology", "Pediatric Cardiology", "Pediatric Neurology", "Pediatric Pulmonology"]
    },
    {
        hospitalId: "HOSP017",
        hospitalName: "Government General Hospital",
        address: "Eluru",
        city: "Eluru",
        state: "Andhra Pradesh",
        contactNumber: "08812-181818",
        specializations: ["Emergency Medicine", "Gynecology & Obstetrics", "Psychiatry", "Hematology", "Ophthalmology"]
    }
];

async function seedHospitals() {
    try {
        await Hospital.deleteMany({}); // Clear existing hospitals if any
        await Hospital.insertMany(hospitals);
        console.log("Hospitals preloaded successfully with the new list!");
        process.exit(0);
    } catch (err) {
        console.error("Error preloading hospitals:", err);
        process.exit(1);
    }
}

seedHospitals();
