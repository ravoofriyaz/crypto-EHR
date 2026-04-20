const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
require("dotenv").config();
require("./db");

const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const User = require("./models/User");
const Record = require("./models/Record");
const Hospital = require("./models/Hospital");
const Access = require("./models/Access");
const Appointment = require("./models/Appointment");
const AuditLog = require("./models/AuditLog");
const bcrypt = require("bcrypt");
const { signData, verifyData } = require("./utils/digitalSignature");
const { generateOTP, verifyOTP, isVerified, clearOTP, forceVerify } = require("./utils/otpService");

// [SECURITY] Ensure uploads directory exists on start
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
  console.log("Created uploads directory");
}

// Multer Storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname)
});
const upload = multer({ storage });

const app = express();
app.use(cors());
app.use(bodyParser.json());

/* -------------------------------------------------------------------------- */
/*                           CRYPTOGRAPHY UTILS                               */
/* -------------------------------------------------------------------------- */

// Load RSA Keys
const keysDir = path.join(__dirname, 'keys');
const publicKey = fs.readFileSync(path.join(keysDir, 'public.pem'), 'utf8');

// [SECURITY] Load Private Key from Environment Variable
if (!process.env.PRIVATE_KEY) {
  console.error("FATAL ERROR: PRIVATE_KEY is not defined in .env");
  process.exit(1);
}
const privateKey = process.env.PRIVATE_KEY.replace(/\\n/g, '\n');

const ALGORITHM = 'aes-256-gcm';

// Helper to Hash IDs (SHA-256)
function hashId(id) {
  return crypto.createHash('sha256').update(id).digest('hex');
}

// [NEW] Encrypt a single field
// Returns format: "ivHex:authTagHex:encryptedHex"
function encryptField(text, aesKey) {
  if (!text) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, aesKey, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

// [NEW] Decrypt a single field
// Expects format: "ivHex:authTagHex:encryptedHex"
function decryptField(encryptedStr, aesKey) {
  if (!encryptedStr) return null;
  try {
    const parts = encryptedStr.split(':');
    if (parts.length !== 3) return "[Invalid Format]";

    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encryptedText = parts[2];

    const decipher = crypto.createDecipheriv(ALGORITHM, aesKey, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error("Field Decryption Error:", err.message);
    return "[Decryption Failed]";
  }
}

// [NEW] Get SHA-256 Hash of a File
function getFileHash(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', data => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', err => reject(err));
  });
}

// File Encryption Helper
function encryptFile(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const aesKey = crypto.randomBytes(32);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGORITHM, aesKey, iv);

    const input = fs.createReadStream(inputPath);
    const output = fs.createWriteStream(outputPath);

    input.pipe(cipher).pipe(output);

    output.on('finish', () => {
      const authTag = cipher.getAuthTag().toString('hex');
      // Encrypt the AES key with RSA
      const encryptedAesKey = crypto.publicEncrypt(
        {
          key: publicKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: "sha256",
        },
        aesKey
      ).toString("base64");

      resolve({
        encryptedAesKey,
        iv: iv.toString('hex'),
        authTag
      });
    });

    output.on('error', reject);
  });
}

// File Decryption Helper
function decryptFile(inputPath, encryptedAesKey, ivHex, authTagHex, res) {
  try {
    const aesKey = crypto.privateDecrypt(
      {
        key: privateKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
      },
      Buffer.from(encryptedAesKey, "base64")
    );

    const decipher = crypto.createDecipheriv(ALGORITHM, aesKey, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));

    const input = fs.createReadStream(inputPath);
    input.pipe(decipher).pipe(res);

    decipher.on('error', (err) => {
      console.error("File Decryption Stream Error:", err);
      res.end();
    });

  } catch (err) {
    console.error("File Decryption Setup Error:", err);
    throw err;
  }
}


/* -------- OTP REGISTRATION FLOW -------- */
// Twilio Initialization
let twilioClient = null;
const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_VERIFY_SERVICE_SID } = process.env;

if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_AUTH_TOKEN !== 'your_auth_token_here') {
  const twilio = require('twilio');
  twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  console.log("Twilio Client Initialized for OTP Verification");
}

const otpStore = new Map(); // Simple in-memory map for OTPs: phone -> { otp, expires }

// Helper to format Indian numbers if a + isn't provided
function formatPhone(phone) {
  let formatted = phone.trim();
  if (formatted.length === 10 && !formatted.startsWith('+')) {
    formatted = '+91' + formatted;
  }
  return formatted;
}

app.post("/sendRegistrationOtp", async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).send("Phone number is required");

    // Check if phone number limits reached (max 10 IDs per phone)
    const existingPhoneCount = await User.countDocuments({ phone });
    if (existingPhoneCount >= 10) {
      return res.status(400).send("This phone number has reached the maximum limit of 10 registered accounts.");
    }

    const formattedPhone = formatPhone(phone);

    let twilioSuccess = false;

    if (twilioClient && TWILIO_VERIFY_SERVICE_SID) {
      console.log(`[TWILIO] Requesting verification SMS to ${formattedPhone}...`);
      try {
        await twilioClient.verify.v2.services(TWILIO_VERIFY_SERVICE_SID)
          .verifications
          .create({ to: formattedPhone, channel: 'sms' });
        twilioSuccess = true;
      } catch (twilioErr) {
        console.error(`[TWILIO ERROR] Failed to send SMS: ${twilioErr.message}`);
        console.log(`[TWILIO] Falling back to Developer OTP mode...`);
      }
    }

    if (!twilioSuccess) {
      // Generate 6-digit OTP (DEV Fallback)
      const otp = Math.floor(100000 + Math.random() * 900000).toString();

      // Store OTP with 5-minute expiration
      otpStore.set(formattedPhone, {
        otp: otp,
        expires: Date.now() + 5 * 60 * 1000
      });

      console.log(`[DEV OTP NOTIFICATION] OTP for ${formattedPhone} is: ${otp}`);
    }


    res.send("OTP sent successfully to " + phone);
  } catch (err) {
    console.error("OTP Error:", err);
    res.status(500).send("Failed to send OTP");
  }
});

/* -------- HOSPITAL MODULE -------- */
app.get("/hospitals", async (req, res) => {
  try {
    const hospitals = await Hospital.find({}, { specializations: 0 }); // Exclude specializations for list
    res.json(hospitals);
  } catch (err) {
    res.status(500).send("Error fetching hospitals");
  }
});

app.get("/hospitals/:hospitalId/specializations", async (req, res) => {
  try {
    const hospital = await Hospital.findOne({ hospitalId: req.params.hospitalId });
    if (!hospital) return res.status(404).send("Hospital not found");
    res.json(hospital.specializations);
  } catch (err) {
    res.status(500).send("Error fetching specializations");
  }
});

// Symptom to Specialization Mapping
const symptomMapping = {
  // 1 Cardiology
  "chest pain": "Cardiology",
  "heart pain": "Cardiology",
  "palpitations": "Cardiology",
  "shortness of breath": "Cardiology",
  "heart attack": "Cardiology",
  "chest tightness": "Cardiology",
  "rapid heartbeat": "Cardiology",
  "fainting": "Cardiology",
  "heartburn confusion": "Cardiology",
  "cold sweats": "Cardiology",
  "fatigue on exertion": "Cardiology",
  "heart murmur": "Pediatric Cardiology",
  "heart blockage": "Cardiothoracic Surgery",

  // 2 Neurology
  // 2 Neurology
  "headache": "Neurology",
  "migraine": "Neurology",
  "seizures": "Pediatric Neurology",
  "brain injury": "Neurosurgery",
  "seizure": "Neurology",
  "stroke": "Neurology",
  "paralysis": "Neurology",
  "dizziness": "Neurology",
  "tremors": "Neurology",
  "tingling sensation": "Neurology",
  "loss of balance": "Neurology",
  "slurred speech": "Neurology",
  "vision disturbances": "Neurology",
  "sudden weakness": "Neurology",

  // 3 Gastroenterology
  "stomach pain": "Gastroenterology",
  "acidity": "Gastroenterology",
  "digestion": "Gastroenterology",
  "constipation": "Gastroenterology",
  "diarrhea": "Gastroenterology",
  "bloating": "Gastroenterology",
  "jaundice": "Gastroenterology",
  "loss of appetite": "Gastroenterology",
  "acid reflux": "Gastroenterology",

  // 4 Pulmonology
  "breathing difficulty": "Pulmonology",
  "asthma": "Pulmonology",
  "childhood asthma": "Pediatric Pulmonology",
  "cough": "Pulmonology",
  "lung problem": "Pulmonology",
  "lung tumor": "Oncology",
  "chest heaviness": "Pulmonology",
  "night cough": "Pulmonology",
  "persistent cold": "Pulmonology",
  "breathlessness": "Pulmonology",
  "snoring issues": "Pulmonology",
  "sleep apnea": "Pulmonology",

  // 5 General Medicine
  "fatigue": "General Medicine",
  "chills": "General Medicine",
  "sweating": "General Medicine",
  "mild infections": "General Medicine",
  "general weakness": "General Medicine",
  "fever": "General Medicine",
  "routine health check": "General Medicine",
  "general medicine": "General Medicine",

  // 6 General Surgery
  "abdominal swelling": "General Surgery",
  "piles": "General Surgery",
  "fistula": "General Surgery",
  "cyst": "General Surgery",
  "abscess": "General Surgery",
  "surgical follow-up": "General Surgery",
  "appendicitis": "General Surgery",

  // 7 Orthopedics
  "joint pain": "Orthopedics",
  "fracture": "Orthopedics",
  "leg fracture": "Orthopedics",
  "bone pain": "Orthopedics",
  "back pain": "Orthopedics",
  "knee pain": "Orthopedics",
  "shoulder pain": "Orthopedics",
  "neck pain": "Orthopedics",
  "muscle stiffness": "Orthopedics",
  "sprain": "Orthopedics",
  "sports injury": "Orthopedics",
  "difficulty walking": "Orthopedics",

  // 8 Dermatology
  "skin rash": "Dermatology",
  "itching": "Dermatology",
  "acne": "Dermatology",
  "skin allergy": "Dermatology",
  "eczema": "Dermatology",
  "dandruff": "Dermatology",
  "fungal infection": "Dermatology",
  "skin infection": "Dermatology",
  "pigmentation": "Dermatology",
  "dark spots": "Dermatology",
  "nail infection": "Dermatology",

  // 9 ENT
  "ear pain": "ENT (Otolaryngology)",
  "ear infection": "ENT (Otolaryngology)",
  "throat pain": "ENT (Otolaryngology)",
  "nose problem": "ENT (Otolaryngology)",
  "hearing": "ENT (Otolaryngology)",
  "vertigo": "ENT (Otolaryngology)",
  "blocked ear": "ENT (Otolaryngology)",
  "loss of smell": "ENT (Otolaryngology)",
  "voice change": "ENT (Otolaryngology)",
  "nasal congestion": "ENT (Otolaryngology)",
  "throat infection": "ENT (Otolaryngology)",

  // 10 Urology
  "frequent urination": "Urology",
  "male infertility": "Urology",
  "testicular pain": "Urology",
  "urinary retention": "Urology",
  "kidney stone": "Urology",
  "kidney stones": "Urology",
  "bladder pain": "Urology",
  "erectile dysfunction": "Urology",
  "urology": "Urology",

  // 11 Oncology
  "cancer": "Oncology",
  "tumor": "Oncology",
  "chemotherapy": "Oncology",
  "persistent cough with blood": "Oncology",
  "unusual bleeding": "Oncology",
  "long-term fatigue": "Oncology",
  "abnormal growth": "Oncology",
  "suspicious mole": "Oncology",

  // 12 Nephrology
  "kidney pain": "Nephrology",
  "kidney disease": "Nephrology",
  "urinary problem": "Nephrology",
  "dialysis": "Nephrology",
  "high creatinine": "Nephrology",
  "reduced urine output": "Nephrology",
  "swollen ankles": "Nephrology",
  "protein in urine": "Nephrology",
  "chronic swelling": "Nephrology",

  // 13 Cardiothoracic Surgery
  "severe valve disorder": "Cardiothoracic Surgery",
  "bypass requirement": "Cardiothoracic Surgery",
  "chest trauma": "Cardiothoracic Surgery",
  "lung mass": "Cardiothoracic Surgery",
  "aortic aneurysm": "Cardiothoracic Surgery",

  // 14 Neurosurgery
  "brain swelling": "Neurosurgery",
  "spinal injury": "Neurosurgery",
  "severe nerve pain": "Neurosurgery",
  "brain hemorrhage": "Neurosurgery",

  // 15 Critical Care
  "septic shock": "Critical Care Medicine",
  "multi-organ failure": "Critical Care Medicine",
  "severe infection": "Critical Care Medicine",
  "severe trauma": "Critical Care Medicine",
  "ventilator support": "Critical Care Medicine",
  "cardiac arrest": "Critical Care Medicine",

  // 16 Endocrinology
  "excessive thirst": "Endocrinology",
  "diabetes": "Endocrinology",
  "weight fluctuations": "Endocrinology",
  "hair thinning": "Endocrinology",
  "delayed puberty": "Endocrinology",
  "hormonal acne": "Endocrinology",
  "endocrinology": "Endocrinology",

  // 17 Rheumatology
  "morning stiffness": "Rheumatology",
  "joint swelling": "Rheumatology",
  "arthritis": "Rheumatology",
  "chronic fatigue": "Rheumatology",
  "muscle pain": "Rheumatology",
  "autoimmune flare-ups": "Rheumatology",
  "rheumatology": "Rheumatology",

  // 18 Plastic Surgery
  "facial deformity": "Plastic Surgery",
  "facial injury": "Plastic Surgery",
  "cosmetic consultation": "Plastic Surgery",
  "burn scars": "Plastic Surgery",
  "trauma reconstruction": "Plastic Surgery",
  "skin graft": "Plastic Surgery",

  // 19 Anesthesiology
  "chronic back pain": "Anesthesiology",
  "nerve pain": "Anesthesiology",
  "surgery preparation": "Anesthesiology",
  "surgical fitness": "Anesthesiology",
  "pain relief consultation": "Anesthesiology",

  // 20 Radiology
  "scan referral": "Radiology",
  "ct scan analysis": "Radiology",
  "imaging evaluation": "Radiology",
  "diagnostic imaging": "Radiology",
  "fracture imaging": "Radiology",

  // 21 Pediatrics
  "child fever": "Pediatrics",
  "baby fever": "Pediatrics",
  "pediatric": "Pediatrics",
  "child health": "Pediatrics",
  "delayed speech": "Pediatrics",
  "frequent infections": "Pediatrics",
  "child vomiting": "Pediatrics",
  "bedwetting": "Pediatrics",
  "growth delay": "Pediatrics",

  // 22 Neonatology
  "newborn jaundice": "Neonatology",
  "newborn checkup": "Neonatology",
  "neonatal infection": "Neonatology",
  "feeding difficulty": "Neonatology",
  "nicu admission": "Neonatology",

  // 23 Pediatric Cardiology
  "blue baby syndrome": "Pediatric Cardiology",
  "rapid heartbeat in child": "Pediatric Cardiology",
  "congenital defect": "Pediatric Cardiology",

  // 24 Pediatric Neurology
  "autism evaluation": "Pediatric Neurology",
  "hyperactivity": "Pediatric Neurology",
  "development delay": "Pediatric Neurology",
  "seizures in child": "Pediatric Neurology",

  // 25 Pediatric Pulmonology
  "recurrent bronchitis": "Pediatric Pulmonology",
  "breathing noise in child": "Pediatric Pulmonology",
  "chronic wheezing": "Pediatric Pulmonology",

  // 26 Emergency Medicine
  "emergency": "Emergency Medicine",
  "accident": "Emergency Medicine",
  "trauma": "Emergency Medicine",
  "injury": "Emergency Medicine",
  "accident injury": "Emergency Medicine",
  "stroke symptoms": "Emergency Medicine",
  "severe accident": "Emergency Medicine",
  "sudden unconsciousness": "Emergency Medicine",
  "poisoning": "Emergency Medicine",
  "severe allergic reaction": "Emergency Medicine",

  // 27 Gynecology & Obstetrics
  "pregnancy": "Gynecology & Obstetrics",
  "pregnancy checkup": "Gynecology & Obstetrics",
  "maternity": "Gynecology & Obstetrics",
  "menstrual": "Gynecology & Obstetrics",
  "period pain": "Gynecology & Obstetrics",
  "women health": "Gynecology & Obstetrics",
  "infertility": "Gynecology & Obstetrics",
  "vaginal infection": "Gynecology & Obstetrics",
  "heavy bleeding": "Gynecology & Obstetrics",
  "abdominal cramps": "Gynecology & Obstetrics",
  "prenatal care": "Gynecology & Obstetrics",

  // 28 Psychiatry
  "mental health": "Psychiatry",
  "depression": "Psychiatry",
  "anxiety": "Psychiatry",
  "stress": "Psychiatry",
  "panic attacks": "Psychiatry",
  "hallucinations": "Psychiatry",
  "suicidal thoughts": "Psychiatry",
  "mood swings": "Psychiatry",
  "addiction": "Psychiatry",

  // 29 Hematology
  "excessive bleeding": "Hematology",
  "low hemoglobin": "Hematology",
  "pale skin": "Hematology",
  "clotting disorder": "Hematology",
  "blood cancer suspicion": "Hematology",

  // 30 Ophthalmology
  "eye problem": "Ophthalmology",
  "vision": "Ophthalmology",
  "cataract": "Ophthalmology",
  "eye pain": "Ophthalmology",
  "blurred vision": "Ophthalmology",
  "dry eyes": "Ophthalmology",
  "eye redness": "Ophthalmology",
  "double vision": "Ophthalmology",
  "eye discharge": "Ophthalmology",
  "light sensitivity": "Ophthalmology"
};

app.post("/recommend-hospital", async (req, res) => {
  try {
    const { complaint } = req.body;
    if (!complaint) return res.status(400).send("Complaint is required");

    const lowercaseComplaint = complaint.toLowerCase().trim();
    console.log(`[DEBUG] Received complaint: "${complaint}" -> processed: "${lowercaseComplaint}"`);
    let identifiedSpecialization = null;

    // Get symptoms sorted by length (longest first) to match specific phrases over general words
    const sortedSymptoms = Object.keys(symptomMapping).sort((a, b) => b.length - a.length);

    // Check mapping
    for (const symptom of sortedSymptoms) {
      if (lowercaseComplaint.includes(symptom.toLowerCase())) {
        console.log(`[DEBUG] Matched symptom key: "${symptom}"`);
        identifiedSpecialization = symptomMapping[symptom];
        break;
      }
    }

    if (!identifiedSpecialization) {
      console.log(`[DEBUG] No specialization found for: "${lowercaseComplaint}"`);
      return res.json({
        success: false,
        message: "We couldn't identify the specific specialization for your complaint. Please try keywords like 'chest pain', 'headache', 'child fever', etc."
      });
    }

    console.log(`[DEBUG] Identified specialization: "${identifiedSpecialization}"`);

    // Find hospitals with this specialization
    const hospitals = await Hospital.find({ specializations: identifiedSpecialization });

    // For each hospital, find doctors in that specialization
    const specRegex = new RegExp(identifiedSpecialization, 'i');
    const results = await Promise.all(hospitals.map(async (hosp) => {
      const doctors = await User.find({
        role: 'doctor',
        hospitalId: hosp.hospitalId,
        $or: [
          { department: specRegex },
          { specialization: specRegex },
          { specialist: specRegex }
        ]
      }, { password: 0 }); // Exclude only password

      return {
        hospital: hosp,
        doctors: doctors
      };
    }));

    res.json({
      success: true,
      specialization: identifiedSpecialization,
      recommendations: results
    });

  } catch (err) {
    console.error("Recommendation Error:", err);
    res.status(500).send("Error fetching recommendations");
  }
});

/* -------- REGISTRATION -------- */
app.post("/register", async (req, res) => {
  try {
    const {
      userId, name, phone, otp, password, role, hospitalId, hospitalName, department,
      gender, dob, email, address, city, state, country, pincode,
      specialization, specialist, registrationNumber, experienceYears,
      clinicName, workingHours, consultationFees, shopName, license
    } = req.body;

    if (!phone || !otp) {
      return res.status(400).send("Phone number and OTP are required for registration.");
    }

    const formattedPhone = formatPhone(phone);

    let twilioVerified = false;
    let fallbackToDev = false;

    if (twilioClient && TWILIO_VERIFY_SERVICE_SID) {
      // Verify using Twilio API
      try {
        const verificationCheck = await twilioClient.verify.v2.services(TWILIO_VERIFY_SERVICE_SID)
          .verificationChecks
          .create({ to: formattedPhone, code: otp });

        if (verificationCheck.status !== 'approved') {
          return res.status(400).send("Invalid or expired OTP. Please try again.");
        }
        twilioVerified = true;
      } catch (twilioErr) {
        console.error(`[TWILIO VERIFY ERROR] ${twilioErr.message}. Checking Developer OTP Store...`);
        fallbackToDev = true; // Proceed to fallback
      }
    } else {
      fallbackToDev = true;
    }

    if (fallbackToDev) {
      // Verify using DEV Fallback map
      const storedData = otpStore.get(formattedPhone);
      if (!storedData) {
        return res.status(400).send("No OTP requested for this phone number.");
      }

      if (Date.now() > storedData.expires) {
        otpStore.delete(formattedPhone);
        return res.status(400).send("OTP has expired. Please request a new one.");
      }

      if (storedData.otp !== otp) {
        return res.status(400).send("Invalid OTP entered.");
      }

      // OTP is valid, proceed!
      otpStore.delete(formattedPhone);
    }

    // Hash User ID for Lookup
    const userIdHash = hashId(userId);

    // Encrypt User ID for Recovery (RSA Public Key)
    const userIdEncryped = crypto.publicEncrypt(
      {
        key: publicKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
      },
      Buffer.from(userId)
    ).toString("base64");

    // Check if ID exists (via hash)
    const existingUser = await User.findOne({ userIdHash });
    if (existingUser) {
      return res.status(400).send("User ID already exists. Please choose a different one.");
    }

    // Check if phone number limits reached (max 10 IDs per phone)
    const existingPhoneCount = await User.countDocuments({ phone });
    if (existingPhoneCount >= 10) {
      return res.status(400).send("This phone number has reached the maximum limit of 10 registered accounts.");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      userIdHash,
      userIdEnc: userIdEncryped,
      name,
      phone,
      password: hashedPassword,
      role,
      hospitalId: role === 'doctor' ? hospitalId : null,
      hospitalName: role === 'doctor' ? hospitalName : null,
      department: role === 'doctor' ? department : null,
      gender,
      dob,
      email,
      address,
      city,
      state,
      country,
      pincode,
      specialization,
      specialist: role === 'doctor' ? department : specialist, // Link department to specialist for doctors
      registrationNumber,
      experienceYears,
      clinicName,
      shopName,
      workingHours,
      consultationFees,
      license
    });

    await newUser.save();
    console.log(`Registered ${role}: ${userIdHash.substring(0, 10)}...`);
    res.send(`${role} registered successfully`);
  } catch (err) {
    console.log("--------------- REGISTRATION ERROR ---------------");
    console.log(err.message);
    if (err.code === 11000) console.log("Duplicate Key Error:", err.keyValue);
    res.status(500).send("Error registering user: " + err.message);
  }
});

/* -------- LOGIN -------- */
app.post("/login", async (req, res) => {
  try {
    const { userId, password, role } = req.body;
    const userIdHash = hashId(userId);

    const user = await User.findOne({ userIdHash, role });
    if (!user) return res.status(401).send("Invalid ID or Role");

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).send("Invalid Password");

    res.json({
      userId: userId,
      name: user.name,
      role: user.role,
      phone: user.phone,
      gender: user.gender,
      dob: user.dob,
      bloodGroup: user.bloodGroup,
      hospitalId: user.hospitalId,
      hospitalName: user.hospitalName,
      department: user.department,
      specialization: user.specialization,
      specialist: user.specialist,
      registrationNumber: user.registrationNumber,
      experienceYears: user.experienceYears,
      workingHours: user.workingHours,
      shopName: user.shopName,
      license: user.license
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Login failed");
  }
});

/* -------- UPDATE PROFILE -------- */
app.post("/updateProfile", async (req, res) => {
  try {
    const {
      userId, name, phone, gender, dob, bloodGroup,
      email, address, city, state, country, pincode,
      hospital, specialization, specialist, registrationNumber,
      experienceYears, clinicName, workingHours, consultationFees,
      shopName, license
    } = req.body;

    const userIdHash = hashId(userId);
    const user = await User.findOne({ userIdHash });
    if (!user) return res.status(404).send("User not found");

    if (name) user.name = name;
    if (phone) user.phone = phone;
    if (gender) user.gender = gender;
    if (dob) user.dob = dob;
    if (bloodGroup) user.bloodGroup = bloodGroup;

    // Address
    if (email) user.email = email;
    if (address) user.address = address;
    if (city) user.city = city;
    if (state) user.state = state;
    if (country) user.country = country;
    if (pincode) user.pincode = pincode;

    // Professional
    if (hospital) user.hospitalName = hospital;
    if (req.body.hospitalId) user.hospitalId = req.body.hospitalId;
    if (req.body.hospitalName) user.hospitalName = req.body.hospitalName;
    if (req.body.department) user.department = req.body.department;
    if (specialization) user.specialization = specialization;
    if (specialist) user.specialist = specialist;
    if (registrationNumber) user.registrationNumber = registrationNumber;
    if (experienceYears) user.experienceYears = experienceYears;
    if (clinicName) user.clinicName = clinicName;
    if (shopName) user.shopName = shopName;
    if (workingHours) user.workingHours = workingHours;
    if (consultationFees) user.consultationFees = consultationFees;
    if (license) user.license = license;

    await user.save();
    console.log(`Updated profile for ${userIdHash.substring(0, 10)}...`);

    res.json({
      userId: userId,
      name: user.name,
      role: user.role,
      phone: user.phone,
      gender: user.gender,
      dob: user.dob,
      specialization: user.specialization,
      specialist: user.specialist,
      department: user.department,
      registrationNumber: user.registrationNumber,
      hospitalId: user.hospitalId,
      hospitalName: user.hospitalName,
      bloodGroup: user.bloodGroup,
      license: user.license,
      shopName: user.shopName,
      workingHours: user.workingHours,
      experienceYears: user.experienceYears
    });
  } catch (err) {
    console.error("Update Profile Error:", err);
    res.status(500).send("Error updating profile");
  }
});

/* -------- ADD MEDICAL RECORD (FIELD ENCRYPTION) -------- */
app.post("/addRecord", upload.single("file"), async (req, res) => {
  try {
    console.log("Request received at /addRecord");
    const {
      patientId, doctorId, doctorName, hospitalId, hospitalName, department,
      disease, provisionalDiagnosis, finalDiagnosis, icdCode, reason, precautions,
      medicines, bloodPressure, heartRate, temperature, notes,
      visitDate, visitType, chiefComplaint, complaintDuration, medicalHistory,
      appointmentId // Added appointmentId
    } = req.body;

    // Check Authorization First if doctorId is provided
    if (doctorId && patientId !== doctorId) {
      const patientIdHash = hashId(patientId);
      const doctorIdHash = hashId(doctorId);

      const access = await Access.findOne({ patientId: patientIdHash, doctorId: doctorIdHash });

      if (!access) {
        return res.status(403).send("Unauthorized: You must request access from the patient or use Emergency Override before adding records.");
      }

      if (access.expiresAt && new Date() > access.expiresAt) {
        await Access.deleteOne({ _id: access._id });
        return res.status(403).send("Unauthorized: Your access has expired. Please request access again.");
      }
    }

    // 1. Generate AES Master Key for this Record
    const recordAesKey = crypto.randomBytes(32);

    // Encrypt the Master Key with RSA Public Key (to store in DB)
    const encodedRecordKey = crypto.publicEncrypt(
      { key: publicKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" },
      recordAesKey
    ).toString("base64");

    // 2. Encrypt Fields
    const encDisease = encryptField(disease || "", recordAesKey);
    const encReason = encryptField(reason || "", recordAesKey);
    const encMedicines = encryptField(medicines || "", recordAesKey);
    const encPrecautions = encryptField(precautions || "", recordAesKey);

    const encBloodPressure = encryptField(bloodPressure || "", recordAesKey);
    const encHeartRate = encryptField(heartRate || "", recordAesKey);
    const encTemperature = encryptField(temperature || "", recordAesKey);
    const encNotes = encryptField(notes || "", recordAesKey);

    const encProvisionalDiagnosis = encryptField(provisionalDiagnosis || "", recordAesKey);
    const encFinalDiagnosis = encryptField(finalDiagnosis || "", recordAesKey);
    const encIcdCode = encryptField(icdCode || "", recordAesKey);

    const encVisitDate = encryptField(visitDate || "", recordAesKey);
    const encVisitType = encryptField(visitType || "", recordAesKey);

    // Hospital-Centric Encrypted Fields
    const encHospitalName = encryptField(hospitalName || "", recordAesKey);
    const encDoctorName = encryptField(doctorName || "", recordAesKey);
    const encDepartment = encryptField(department || "", recordAesKey);

    const encChiefComplaint = encryptField(chiefComplaint || "", recordAesKey);
    const encComplaintDuration = encryptField(complaintDuration || "", recordAesKey);
    const encMedicalHistory = encryptField(medicalHistory || "", recordAesKey);

    // 3. File Handling
    let fileData = { hasFile: false };
    let originalFilePath = null;
    let encryptedFilePath = null;

    if (req.file) {
      originalFilePath = req.file.path;
      encryptedFilePath = originalFilePath + ".enc";
      const { encryptedAesKey, iv, authTag } = await encryptFile(originalFilePath, encryptedFilePath);
      fs.unlinkSync(originalFilePath);
      const encOriginalName = encryptField(req.file.originalname, recordAesKey);
      fileData = {
        hasFile: true,
        encryptedOriginalName: encOriginalName,
        mimeType: req.file.mimetype,
        encryptedPath: req.file.filename + ".enc",
        fileKey: encryptedAesKey,
        iv,
        authTag
      };
    }

    if (!patientId) {
      if (originalFilePath && fs.existsSync(originalFilePath)) fs.unlinkSync(originalFilePath);
      return res.status(400).send("Patient ID is missing");
    }

    const patientIdHash = hashId(patientId);
    const patientUser = await User.findOne({ userIdHash: patientIdHash });
    if (!patientUser) {
      if (originalFilePath && fs.existsSync(originalFilePath)) fs.unlinkSync(originalFilePath);
      return res.status(404).send("Patient not found");
    }

    // 4. Create Integrity Hash (SHA-256 of Plaintext)
    const plaintextForHash = JSON.stringify({
      hospitalId, hospitalName, doctorId, doctorName, department,
      visitDate, visitType, chiefComplaint, complaintDuration, medicalHistory,
      disease, provisionalDiagnosis, finalDiagnosis, icdCode, reason, precautions,
      medicines, bloodPressure, heartRate, temperature, notes,
      fileName: req.file ? req.file.originalname : ""
    });
    const recordHash = crypto.createHash('sha256').update(plaintextForHash).digest('hex');

    // 5. Digital Signature
    // We sign the record metadata hash + hash of encrypted file (if exists)
    let finalSignatureHash = recordHash;
    if (req.file && encryptedFilePath) {
      const fileEncHash = await getFileHash(encryptedFilePath);
      finalSignatureHash = crypto.createHash('sha256').update(recordHash + fileEncHash).digest('hex');
    }

    // We use the server's private key for signing for now
    const signature = signData(finalSignatureHash, privateKey);

    // 6. Save to MongoDB

    const record = new Record({
      patientId: patientIdHash,
      doctorId: doctorId ? hashId(doctorId) : null,
      doctorName: encDoctorName,
      hospitalId: hospitalId || null,
      hospitalName: encHospitalName,
      department: encDepartment,
      appointmentId: appointmentId || null, // Link to appointment

      visitDate: encVisitDate,
      visitType: encVisitType,

      chiefComplaint: encChiefComplaint,
      complaintDuration: encComplaintDuration,
      medicalHistory: encMedicalHistory,

      disease: encDisease,
      provisionalDiagnosis: encProvisionalDiagnosis,
      finalDiagnosis: encFinalDiagnosis,
      icdCode: encIcdCode,

      reason: encReason,
      medicines: encMedicines,
      precautions: encPrecautions,

      bloodPressure: encBloodPressure,
      heartRate: encHeartRate,
      temperature: encTemperature,
      notes: encNotes,

      file: fileData,
      recordKey: encodedRecordKey,
      hash: recordHash,

      // Digital Signature Info
      digitalSignature: signature,
      signedBy: doctorId || "HOSPITAL_SERVER",
      signedAt: new Date(),

      timestamp: new Date()
    });

    const savedRecord = await record.save();

    // 5.5 If linked to an appointment, mark as Completed
    if (appointmentId) {
      await Appointment.findByIdAndUpdate(appointmentId, { status: "Completed" });
    }

    // 6. Update Patient's hospitalsVisited list
    if (hospitalId) {
      console.log(`Updating visit history for patient ${patientIdHash} at hospital ${hospitalId}`);

      let hospitalVisit = patientUser.hospitalsVisited.find(h => h.hospitalId === hospitalId);

      let docSpec = "";
      const doc = await User.findOne({ userIdHash: doctorId ? hashId(doctorId) : "" });
      if (doc) docSpec = doc.specialist || doc.specialization || "";

      const newConsultation = {
        doctorId: doctorId || "HOSPITAL_INTERNAL",
        doctorName: doctorName || "Staff Doctor",
        doctorSpecialization: docSpec,
        visitDate: visitDate || new Date().toISOString().split('T')[0],
        recordId: savedRecord._id.toString()
      };

      if (!hospitalVisit) {
        console.log("New hospital visit object created");
        hospitalVisit = {
          hospitalId,
          hospitalName,
          doctorsConsulted: [newConsultation]
        };
        patientUser.hospitalsVisited.push(hospitalVisit);
      } else {
        console.log("Existing hospital visit object found, adding consultation");
        hospitalVisit.doctorsConsulted.push(newConsultation);
      }

      // Explicitly tell Mongoose that the nested array has changed
      patientUser.markModified('hospitalsVisited');
      await patientUser.save();
      console.log("Patient visit history updated successfully");
    } else {
      console.warn("No hospitalId provided in record - visit history not updated");
    }

    console.log("Field-Encrypted Record saved to MongoDB successfully");
    res.send(`Record added & Encrypted! (Hash: ${recordHash.substring(0, 10)}...)`);
  } catch (err) {
    console.error("Add Record Critical Error:", err);
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).send("Server Error: " + err.message);
  }
});

/* -------- SEARCH PATIENTS (ID or PHONE) -------- */
app.post("/searchPatients", async (req, res) => {
  try {
    console.log("POST /searchPatients hit with query:", req.body.query);
    const { query } = req.body;
    if (!query) return res.status(400).send("Query is required");

    // Standardize query (remove spaces if phone)
    const cleanQuery = query.trim();

    // Check if it's already a SHA-256 hash (64 hex characters)
    const isAlreadyHash = /^[a-f0-9]{64}$/i.test(cleanQuery);

    // Check if it's a phone search (starts with + or contains digits only)
    let isPhone = /^\+?\d+$/.test(cleanQuery);

    // Formatting phone if needed
    let searchPhone = cleanQuery;
    if (isPhone && searchPhone.length === 10 && !searchPhone.startsWith('+')) {
      searchPhone = '+91' + searchPhone;
    }

    // Find users by ID (Hash) OR Phone
    const userIdHash = isAlreadyHash ? cleanQuery : hashId(cleanQuery);

    const users = await User.find({
      $or: [
        { userIdHash: userIdHash },
        { phone: searchPhone }
      ],
      role: 'patient' // Only search for patients
    });

    if (users.length === 0) {
      return res.json([]); // No results
    }

    // Return info with decrypted patientId
    const results = users.map(u => {
      let realId = "Unknown ID";
      if (u.userIdEnc) {
        try {
          realId = crypto.privateDecrypt(
            { key: privateKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" },
            Buffer.from(u.userIdEnc, "base64")
          ).toString('utf8');
        } catch (e) {
          console.error("Failed to decrypt patient ID", e);
        }
      }
      return {
        userIdHash: u.userIdHash,
        patientId: realId,
        name: u.name,
        phone: u.phone,
        gender: u.gender,
        dob: u.dob
      };
    });

    res.json(results);

  } catch (err) {
    console.error("Search Error:", err);
    res.status(500).send("Search failed");
  }
});

/* -------- VERIFICATION MIDDLEWARE (Example) -------- */
/**
 * Middleware to verify record integrity via digital signature
 */
const verifyRecordIntegrity = async (req, res, next) => {
  try {
    const recordId = req.params.recordId || req.body.recordId;
    if (!recordId) return res.status(400).send("Record ID required for verification");

    const record = await Record.findById(recordId);
    if (!record) return res.status(404).send("Record not found");

    // Recalculate hash of metadata
    // In a real scenario, we'd need to re-generate the plaintextForHash here to verify.
    // For now, we trust the hash in the DB and verify the signature against it.

    let verificationHash = record.hash;
    if (record.file && record.file.hasFile) {
      const filePath = path.join(uploadDir, record.file.encryptedPath);
      if (fs.existsSync(filePath)) {
        const fileEncHash = await getFileHash(filePath);
        verificationHash = crypto.createHash('sha256').update(record.hash + fileEncHash).digest('hex');
      } else {
        console.warn(`[INTEGRITY CHECK] Encrypted file missing for record ${recordId}: ${record.file.encryptedPath}`);
        // If file is missing, we can only verify the metadata hash
      }
    }

    const isValid = verifyData(verificationHash, record.digitalSignature, publicKey);
    if (!isValid) {
      return res.status(403).send("Digital signature verification failed. Records may be untrusted.");
    }

    req.verifiedRecord = record; // Pass the verified record to the next handler
    next();
  } catch (err) {
    console.error("Integrity Check Middleware Error:", err);
    res.status(500).send("Security check failed");
  }
};

/* -------- PATIENT DASHBOARD DATA -------- */
app.get("/getHospitalsVisited/:patientId", async (req, res) => {
  try {
    const patientIdHash = hashId(req.params.patientId);
    const patient = await User.findOne({ userIdHash: patientIdHash });
    if (!patient) return res.status(404).send("Patient not found");
    res.json(patient.hospitalsVisited || []);
  } catch (err) {
    res.status(500).send("Error fetching visit history");
  }
});

// Health check to test connectivity
app.get("/test", (req, res) => {
  res.send("Server is alive and routing correctly!");
});

/* -------- HOSPITAL & DEPARTMENT ROUTES -------- */
app.get("/hospitals", async (req, res) => {
  try {
    const hospitals = await Hospital.find({}, { hospitalId: 1, hospitalName: 1 });
    res.json(hospitals);
  } catch (err) {
    res.status(500).send("Error fetching hospitals");
  }
});

app.get("/hospitals/:hospitalId/departments", async (req, res) => {
  try {
    const { hospitalId } = req.params;
    const hospital = await Hospital.findOne({ hospitalId });
    if (!hospital) return res.status(404).send("Hospital not found");
    res.json(hospital.departments || []);
  } catch (err) {
    res.status(500).send("Error fetching departments");
  }
});

/* -------- SEARCH DOCTORS (ID or PHONE) -------- */
app.post("/searchDoctors", async (req, res) => {
  try {
    console.log("POST /searchDoctors hit with query:", req.body.query);
    const { query } = req.body;
    if (!query) return res.status(400).send("Query is required");

    const cleanQuery = query.trim();
    // Check if it's already a SHA-256 hash
    const isAlreadyHash = /^[a-f0-9]{64}$/i.test(cleanQuery);

    let isPhone = /^\+?\d+$/.test(cleanQuery);
    let searchPhone = cleanQuery;
    if (isPhone && searchPhone.length === 10 && !searchPhone.startsWith('+')) {
      searchPhone = '+91' + searchPhone;
    }

    const userIdHash = isAlreadyHash ? cleanQuery : hashId(cleanQuery);

    const doctors = await User.find({
      $or: [
        { userIdHash: userIdHash },
        { phone: searchPhone }
      ],
      role: 'doctor'
    });

    const results = doctors.map(u => {
      let realId = "Unknown ID";
      if (u.userIdEnc) {
        try {
          realId = crypto.privateDecrypt(
            { key: privateKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" },
            Buffer.from(u.userIdEnc, "base64")
          ).toString('utf8');
        } catch (e) {
          console.error("Failed to decrypt doctor ID", e);
        }
      }
      return {
        userIdHash: u.userIdHash,
        doctorId: realId,
        name: u.name,
        phone: u.phone,
        specialization: u.specialization,
        hospital: u.hospital
      };
    });

    res.json(results);
  } catch (err) {
    console.error("Doctor Search Error:", err);
    res.status(500).send("Search failed");
  }
});

/* -------- FETCH RECORDS (DECRYPTED) -------- */
// MODIFYING TO ACCEPT HASHED ID DIRECTLY IF NEEDED
// Actually, let's keep it simple. If we can't show the real ID, we show Name. 
// For fetching records, we need to identify the patient.
// If we change `getRecords` to accept `patientIdHash` we are good.

app.get("/getRecords/:patientId/:requesterId", async (req, res) => {
  const { patientId, requesterId } = req.params;
  const { isHashed } = req.query; // Check if patientId is already hashed

  try {
    // If lookup is by Hash (from Phone Search), use directly. Else Hash it.
    const patientIdHash = isHashed === 'true' ? patientId : hashId(patientId);

    // Requester ID is from LocalStorage (raw), so hash it.
    const requesterIdHash = hashId(requesterId);

    const patient = await User.findOne({ userIdHash: patientIdHash });
    const requester = await User.findOne({ userIdHash: requesterIdHash });

    if (!patient || !requester) return res.status(404).send("User not found");

    // Check Access
    let isAllowed = false;
    let isPharmacist = false;
    if (patientIdHash === requesterIdHash) {
      isAllowed = true;
    } else if (requester.role === 'pharmacist') {
      isAllowed = true;
      isPharmacist = true;
    } else {
      const access = await Access.findOne({ patientId: patientIdHash, doctorId: requesterIdHash });
      if (access) {
        if (access.expiresAt && new Date() > access.expiresAt) {
          await Access.deleteOne({ _id: access._id });
        } else {
          isAllowed = true;
        }
      }
    }

    if (!isAllowed) return res.status(403).send("Approval required from patient or Access Expired.");

    const records = await Record.find({ patientId: patientIdHash }).sort({ timestamp: -1 });

    // [AUDIT] Log the view event
    if (patientIdHash !== requesterIdHash) {
      const viewLog = new AuditLog({
        doctorId: requesterIdHash,
        patientId: patientIdHash,
        action: "Medical Records Viewed",
        hospitalId: requester.hospitalId || "PHARMACY_OR_OTHER",
        details: `Records viewed by ${requester.name} (${requester.role})`
      });
      await viewLog.save();
    }

    const decryptedRecords = await Promise.all(records.map(async r => {
      try {
        // 1. Decrypt Record Key
        const recordAesKey = crypto.privateDecrypt(
          { key: privateKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" },
          Buffer.from(r.recordKey, "base64")
        );

        // 2. Decrypt Fields
        const disease = r.disease ? decryptField(r.disease, recordAesKey) : "";
        const provisionalDiagnosis = r.provisionalDiagnosis ? decryptField(r.provisionalDiagnosis, recordAesKey) : "";
        const finalDiagnosis = r.finalDiagnosis ? decryptField(r.finalDiagnosis, recordAesKey) : "";
        const icdCode = r.icdCode ? decryptField(r.icdCode, recordAesKey) : "";

        const visitDate = r.visitDate ? decryptField(r.visitDate, recordAesKey) : "";
        const visitType = r.visitType ? decryptField(r.visitType, recordAesKey) : "";
        const hospitalName = r.hospitalName ? decryptField(r.hospitalName, recordAesKey) : "";
        const doctorName = r.doctorName ? decryptField(r.doctorName, recordAesKey) : "";
        const department = r.department ? decryptField(r.department, recordAesKey) : "";

        const chiefComplaint = r.chiefComplaint ? decryptField(r.chiefComplaint, recordAesKey) : "";
        const complaintDuration = r.complaintDuration ? decryptField(r.complaintDuration, recordAesKey) : "";
        const medicalHistory = r.medicalHistory ? decryptField(r.medicalHistory, recordAesKey) : "";

        const reason = r.reason ? decryptField(r.reason, recordAesKey) : "";
        const medicines = r.medicines ? decryptField(r.medicines, recordAesKey) : "";
        const precautions = r.precautions ? decryptField(r.precautions, recordAesKey) : "";

        const bloodPressure = r.bloodPressure ? decryptField(r.bloodPressure, recordAesKey) : "";
        const heartRate = r.heartRate ? decryptField(r.heartRate, recordAesKey) : "";
        const temperature = r.temperature ? decryptField(r.temperature, recordAesKey) : "";
        const notes = r.notes ? decryptField(r.notes, recordAesKey) : "";

        // 3. Handle File Metadata
        let fileInfo = null;
        if (r.file && r.file.hasFile) {
          const originalName = decryptField(r.file.encryptedOriginalName, recordAesKey);
          fileInfo = {
            originalName: originalName,
            mimeType: r.file.mimeType,
            hasFile: true
          };
        }

        if (isPharmacist) {
          return {
            _id: r._id,
            visitDate: "[Hidden]",
            visitType: "[Hidden]",
            hospitalName: "[Hidden]",
            chiefComplaint: "[Hidden]",
            complaintDuration: "[Hidden]",
            medicalHistory: "[Hidden]",
            disease: "[Hidden]",
            provisionalDiagnosis: "[Hidden]",
            finalDiagnosis: "[Hidden]",
            icdCode: "[Hidden]",
            reason: "[Hidden]",
            medicines, // Only decrypt medicines
            precautions: "[Hidden]",
            bloodPressure: "[Hidden]",
            heartRate: "[Hidden]",
            temperature: "[Hidden]",
            notes: "[Hidden]",
            file: null, // Hide file metadata
            hash: r.hash,
            timestamp: Math.floor(new Date(r.timestamp).getTime() / 1000),
            patientId: patientId // Include patientId explicitly
          };
        }

        // 4. Fetch Doctor Specialization
        let doctorSpecialization = "";
        const docUser = await User.findOne({ userIdHash: r.doctorId });
        if (docUser) {
          doctorSpecialization = docUser.specialist || docUser.specialization || "";
        }

        return {
          _id: r._id,
          visitDate,
          visitType,
          hospitalId: r.hospitalId,
          hospitalName,
          doctorId: r.doctorId,
          doctorName,
          doctorSpecialization,
          department,
          chiefComplaint,
          complaintDuration,
          medicalHistory,
          disease,
          provisionalDiagnosis,
          finalDiagnosis,
          icdCode,
          reason,
          medicines,
          precautions,
          bloodPressure,
          heartRate,
          temperature,
          notes,
          file: fileInfo,
          hash: r.hash,
          timestamp: Math.floor(new Date(r.timestamp).getTime() / 1000)
        };
      } catch (e) {
        console.error("Decryption failed for record:", r._id, e);
        return {
          _id: r._id,
          disease: "[Encrypted]",
          reason: "[Encrypted]",
          medicines: "[Encrypted]",
          timestamp: Math.floor(new Date(r.timestamp).getTime() / 1000)
        };
      }
    }));

    // [NEW] Bulk Verify Signatures for the UI
    const finalResults = await Promise.all(decryptedRecords.map(async (dr) => {
      const rawRecord = records.find(orig => orig._id.toString() === dr._id.toString());
      if (rawRecord && rawRecord.digitalSignature) {
        // We verify against the metadata hash primarily. 
        // Note: File hash check is skipped here for performance, but done in /getFile
        const isValid = verifyData(rawRecord.hash, rawRecord.digitalSignature, publicKey);
        dr.isVerified = isValid;
      } else {
        dr.isVerified = false;
      }
      return dr;
    }));

    res.json(finalResults);
  } catch (err) {
    console.error("Get Records Error:", err);
    res.status(500).send("Error fetching records: " + err.message);
  }
});

/* -------- GET ENCRYPTED FILE -------- */
app.get("/getFile/:recordId", async (req, res) => {
  try {
    const { recordId } = req.params;
    const { requesterId } = req.query;

    if (!requesterId) return res.status(400).send("Requester ID missing");

    const record = await Record.findById(recordId);
    if (!record) return res.status(404).send("Record not found");

    const patientIdHash = record.patientId;
    const requesterIdHash = hashId(requesterId);

    // Access Check
    let isAllowed = false;
    const requester = await User.findOne({ userIdHash: requesterIdHash });
    if (requester && requester.role === 'pharmacist') {
      return res.status(403).send("Pharmacists cannot view file attachments");
    }

    if (patientIdHash === requesterIdHash) {
      isAllowed = true;
    } else {
      const access = await Access.findOne({ patientId: patientIdHash, doctorId: requesterIdHash });
      if (access) {
        if (access.expiresAt && new Date() > access.expiresAt) {
          await Access.deleteOne({ _id: access._id });
        } else {
          isAllowed = true;
        }
      }
    }

    if (!isAllowed) return res.status(403).send("Unauthorized Access");

    if (!record.file || !record.file.hasFile) return res.status(404).send("No file attached");

    // Decrypt Original Name
    let originalName = "downloaded_file";
    try {
      // 1. Decrypt Record Key
      const recordAesKey = crypto.privateDecrypt(
        { key: privateKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" },
        Buffer.from(record.recordKey, "base64")
      );
      originalName = decryptField(record.file.encryptedOriginalName, recordAesKey);
    } catch (e) {
      console.error("Failed to decrypt filename", e);
    }

    const filePath = path.join(uploadDir, record.file.encryptedPath);

    // [NEW] Digital Signature Verification before access
    try {
      if (fs.existsSync(filePath)) {
        const fileEncHash = await getFileHash(filePath);
        const finalSignatureHash = crypto.createHash('sha256').update(record.hash + fileEncHash).digest('hex');

        const isSignatureValid = verifyData(finalSignatureHash, record.digitalSignature, publicKey);

        if (!isSignatureValid) {
          console.error(`SECURITY ALERT: Digital signature verification failed for record ${recordId}`);
          return res.status(403).send("Digital signature verification failed. File may be tampered.");
        }
      } else {
        console.warn(`[GET FILE] Physical file not found at: ${filePath}. Proceeding to metadata check only.`);
        // Note: If physical file is missing, we can't verify its content hash, but we can return 404
        return res.status(404).send("File not found on server (Physical file missing).");
      }
    } catch (err) {
      console.error("Signature Verification Error (Internal):", err.message);
      return res.status(500).send("Error verifying record integrity.");
    }

    if (!fs.existsSync(filePath)) return res.status(404).send("File not found on server");

    res.setHeader('Content-Type', record.file.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${originalName}"`);

    // Decrypt File Content
    decryptFile(filePath, record.file.fileKey, record.file.iv, record.file.authTag, res);

  } catch (err) {
    console.error("Get File Error:", err);
    res.status(500).send("Error getting file");
  }
});


/* -------- GRANT ACCESS -------- */
app.post("/grantAccess", async (req, res) => {
  try {
    const { patientId, doctorId, durationDays } = req.body;
    const patientIdHash = hashId(patientId);
    const doctorIdHash = hashId(doctorId);

    const patient = await User.findOne({ userIdHash: patientIdHash });
    const doctor = await User.findOne({ userIdHash: doctorIdHash });

    if (!patient) return res.status(400).send(`Patient ${patientId} not found`);
    if (!doctor) return res.status(400).send(`Doctor ${doctorId} not found`);

    let expiresAt = null;
    if (durationDays) {
      const days = parseInt(durationDays);
      if (!isNaN(days) && days > 0) {
        expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + days);
      }
    }

    const existing = await Access.findOne({ patientId: patientIdHash, doctorId: doctorIdHash });
    if (!existing) {
      const newAccess = new Access({
        patientId: patientIdHash,
        doctorId: doctorIdHash,
        expiresAt,
        type: "Manual Grant"
      });
      await newAccess.save();
      console.log(`Access granted.`);
      res.send(`Access granted to doctor!`);
    } else {
      res.send(`Access already exists.`);
    }

  } catch (err) {
    console.error("Grant Access Error:", err);
    res.status(500).send("Server Error: " + err.message);
  }
});

/* -------- EMERGENCY OVERRIDE -------- */
app.post("/emergencyAccess", async (req, res) => {
  try {
    const { doctorId, patientId } = req.body;
    const patientIdHash = hashId(patientId);
    const doctorIdHash = hashId(doctorId);

    const patient = await User.findOne({ userIdHash: patientIdHash });
    const doctor = await User.findOne({ userIdHash: doctorIdHash });

    if (!patient) return res.status(404).send("Patient not found");
    if (!doctor || doctor.role !== "doctor") return res.status(403).send("Unauthorized. Only doctors can override.");

    const existing = await Access.findOne({ patientId: patientIdHash, doctorId: doctorIdHash });
    if (!existing) {
      const emergencyAccess = new Access({
        patientId: patientIdHash,
        doctorId: doctorIdHash,
        type: "emergency",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // Valid for 24 hours
      });
      await emergencyAccess.save();
      res.send("Emergency access granted (Valid for 24h). This action has been logged.");
    } else {
      res.send("Access already exists.");
    }
  } catch (err) {
    console.error("Emergency Access Error:", err);
    res.status(500).send("Server Error");
  }
});

/* -------- SEARCH PATIENT BY PHONE -------- */
app.post("/searchPatientByPhone", async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).send("Phone number is required");

    // Standardize phone
    let searchPhone = phone.trim();
    let isPhone = /^\+?\d+$/.test(searchPhone);
    if (isPhone && searchPhone.length === 10 && !searchPhone.startsWith('+')) {
      searchPhone = '+91' + searchPhone;
    }

    const patients = await User.find({ phone: searchPhone, role: 'patient' });
    if (patients.length === 0) return res.status(404).send("Patient not found with this phone number");

    // Attempt to decrypt original user IDs
    let results = [];
    for (const patient of patients) {
      let realUserId = "Unknown ID";
      if (patient.userIdEnc) {
        try {
          realUserId = crypto.privateDecrypt(
            { key: privateKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" },
            Buffer.from(patient.userIdEnc, "base64")
          ).toString('utf8');
        } catch (e) {
          console.error("Failed to decrypt patient ID", e);
        }
      }

      results.push({
        name: patient.name,
        dob: patient.dob || "Not Provided",
        patientId: realUserId
      });
    }

    res.json(results);
  } catch (err) {
    console.error("Search Patient Error:", err);
    res.status(500).send("Server Error");
  }
});

/* -------- CHECK ACCESS PERMISSION -------- */
app.post("/checkAccess", async (req, res) => {
  try {
    const { patientId, doctorId } = req.body;
    const patientIdHash = hashId(patientId);
    const doctorIdHash = hashId(doctorId);

    if (!patientId || !doctorId) return res.status(400).send("Missing IDs");

    const access = await Access.findOne({ patientId: patientIdHash, doctorId: doctorIdHash });

    if (access) {
      if (access.expiresAt && new Date() > access.expiresAt) {
        await Access.deleteOne({ _id: access._id });
        return res.json({ hasAccess: false, message: "Access expired" });
      }
      return res.json({ hasAccess: true, type: access.type });
    }

    res.json({ hasAccess: false });
  } catch (err) {
    console.error("Check Access Error:", err);
    res.status(500).send("Server Error");
  }
});

/* -------- GET RECEIVED ACCESS LIST (FOR DOCTORS) -------- */
app.get("/getReceivedAccess/:doctorId", async (req, res) => {
  try {
    const { doctorId } = req.params;
    const doctorIdHash = hashId(doctorId);

    // Find all active access records for this doctor
    const now = new Date();
    const accessRecords = await Access.find({
      doctorId: doctorIdHash,
      $or: [
        { expiresAt: null },
        { expiresAt: { $gt: now } }
      ]
    }).sort({ timestamp: -1 });

    const results = await Promise.all(accessRecords.map(async (acc) => {
      // Find patient info
      const patient = await User.findOne({ userIdHash: acc.patientId });
      if (!patient) return null;

      let decryptedPatientId = "Unknown";
      if (patient.userIdEnc) {
        try {
          decryptedPatientId = crypto.privateDecrypt(
            { key: privateKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" },
            Buffer.from(patient.userIdEnc, "base64")
          ).toString('utf8');
        } catch (e) {
          decryptedPatientId = "Encrypted";
        }
      }

      return {
        patientId: decryptedPatientId, // Raw ID for easy click
        patientName: patient.name,
        dob: patient.dob,
        type: acc.type,
        expiresAt: acc.expiresAt
      };
    }));

    res.json(results.filter(r => r !== null));
  } catch (err) {
    console.error("Get Received Access Error:", err);
    res.status(500).send("Error fetching access list");
  }
});

/* -------- GET ACCESS LIST -------- */
app.get("/getAccessList/:patientId", async (req, res) => {
  try {
    const { patientId } = req.params;
    const patientIdHash = hashId(patientId);

    // Find all access records first
    const allAccessList = await Access.find({ patientId: patientIdHash });

    // Filter out expired records and delete them from DB
    const accessList = [];
    for (const acc of allAccessList) {
      if (acc.expiresAt && new Date() > acc.expiresAt) {
        await Access.deleteOne({ _id: acc._id });
      } else {
        accessList.push(acc);
      }
    }

    const enrichedList = (await Promise.all(accessList.map(async (acc) => {
      try {
        const doctor = await User.findOne({ userIdHash: acc.doctorId });

        if (!doctor) {
          // Orphaned access record (doctor not found)
          return null;
        }

        let decryptedDoctorId = "Unknown";
        let doctorName = doctor.name;
        let doctorHospital = doctor.hospitalName || doctor.hospital || "Unknown Hospital";

        if (doctor.userIdEnc) {
          try {
            decryptedDoctorId = crypto.privateDecrypt(
              { key: privateKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" },
              Buffer.from(doctor.userIdEnc, "base64")
            ).toString('utf8');
          } catch (e) {
            decryptedDoctorId = acc.doctorId;
          }
        } else {
          // Fallback for seeded doctors without Enc if we ever search them
          decryptedDoctorId = "Seeded Doctor";
        }

        return {
          doctorId: decryptedDoctorId,
          doctorName: doctorName,
          hospital: doctorHospital,
          type: acc.type,
          expiresAt: acc.expiresAt,
          timestamp: acc.timestamp
        };
      } catch (innerErr) {
        console.error("Enrichment Error:", innerErr);
        return null;
      }
    }))).filter(item => item !== null);

    res.json(enrichedList);
  } catch (err) {
    console.error("Get Access List Error:", err);
    res.status(500).send("Error fetching access list");
  }
});

/* -------- REVOKE ACCESS -------- */
app.post("/revokeAccess", async (req, res) => {
  try {
    const { patientId, doctorId } = req.body;
    const patientIdHash = hashId(patientId);
    let doctorIdHash = hashId(doctorId);

    const result = await Access.deleteOne({
      patientId: patientIdHash,
      $or: [{ doctorId: doctorIdHash }, { doctorId: doctorId }]
    });

    if (result.deletedCount === 0) return res.status(404).send("Access record not found.");
    res.send("Access Revoked Successfully");
  } catch (err) {
    console.error("Revoke Access Error:", err);
    res.status(500).send("Error revoking access");
  }
});

/* -------- AUDIT LOG -------- */
app.get("/audit/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const userIdHash = hashId(userId);

    const records = await Record.find({ patientId: userIdHash }).sort({ timestamp: -1 });
    const access = await Access.find({ patientId: userIdHash }).sort({ timestamp: -1 });
    const persistentLogs = await AuditLog.find({ patientId: userIdHash }).sort({ timestamp: -1 });

    const logs = [];

    // Helper to get Dr. Name from Hash
    const resolveDrInfo = async (hashOrId) => {
      if (!hashOrId) return "Staff";
      const h = hashOrId.length === 64 ? hashOrId : hashId(hashOrId);
      const d = await User.findOne({ userIdHash: h });
      if (!d) return "Unknown Professional";

      let realId = "";
      if (d.userIdEnc) {
        try {
          realId = crypto.privateDecrypt(
            { key: privateKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" },
            Buffer.from(d.userIdEnc, "base64")
          ).toString('utf8');
        } catch (e) { realId = d.name; }
      }
      return {
        name: d.name,
        id: realId || d.name,
        hospital: d.hospitalName || d.hospital || "Medical Center"
      };
    };

    // [RECORD ADDS]
    for (const r of records) {
      const dr = await resolveDrInfo(r.doctorId);
      logs.push({
        type: "Medical Record Added",
        timestamp: r.timestamp,
        details: `Dr. ${dr.name} (${dr.hospital}) uploaded a new encrypted record.`,
        txHash: "Verifiable",
        icon: "fa-file-medical"
      });
    }

    // [ACCESS GRANTS]
    for (const a of access) {
      const dr = await resolveDrInfo(a.doctorId);
      let typeLabel = a.type === "emergency" ? "Emergency Access" : "Direct Access";
      logs.push({
        type: typeLabel,
        timestamp: a.timestamp,
        details: `Portal opened for Dr. ${dr.name} (${dr.id}). ${a.expiresAt ? `Expires: ${new Date(a.expiresAt).toLocaleDateString()}` : "Permanent"}`,
        txHash: "Secured",
        icon: "fa-key"
      });
    }

    // [PERSISTENT AUDIT LOGS]
    for (const pl of persistentLogs) {
      const dr = await resolveDrInfo(pl.doctorId);
      logs.push({
        type: pl.action,
        timestamp: pl.timestamp,
        details: pl.details.replace(pl.doctorId, dr.id || dr.name),
        txHash: "Logged",
        icon: pl.action.includes("View") ? "fa-eye" : "fa-shield-alt"
      });
    }

    // Standardize & Sort
    logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    res.json(logs);
  } catch (err) {
    console.error("Audit Error:", err);
    res.status(500).send("Audit Error");
  }
});


/* -------- APPOINTMENT BOOKING -------- */

// 1. Get doctors by hospital and specialization
app.get("/getDoctorsByHospitalSpecialization/:hospitalId/:specialization", async (req, res) => {
  try {
    const { hospitalId, specialization } = req.params;
    console.log(`[DEBUG] Fetching doctors for Hospital: "${hospitalId}", Spec: "${specialization}"`);

    // Using regex for robust matching (case-insensitive and trimmed)
    const doctors = await User.find({
      role: 'doctor',
      hospitalId: { $regex: new RegExp(`^${hospitalId.trim()}$`, "i") },
      $or: [
        { department: { $regex: new RegExp(`^${specialization.trim()}$`, "i") } },
        { specialist: { $regex: new RegExp(`^${specialization.trim()}$`, "i") } }
      ]
    }, { userIdHash: 1, name: 1, specialist: 1, specialization: 1 });

    console.log(`[DEBUG] Found ${doctors.length} doctors`);
    res.json(doctors);
  } catch (err) {
    console.error("Error fetching doctors:", err);
    res.status(500).send("Error fetching doctors");
  }
});

// 2. Get available slots for a doctor on a specific date
app.get("/getAvailableSlots/:doctorIdHash/:date", async (req, res) => {
  try {
    const { doctorIdHash, date } = req.params;

    const standardSlots = [
      "09:00 AM - 09:30 AM", "09:30 AM - 10:00 AM",
      "10:00 AM - 10:30 AM", "10:30 AM - 11:00 AM",
      "11:00 AM - 11:30 AM", "11:30 AM - 12:00 PM",
      "02:00 PM - 02:30 PM", "02:30 PM - 03:00 PM",
      "03:00 PM - 03:30 PM", "03:30 PM - 04:00 PM",
      "04:00 PM - 04:30 PM", "04:30 PM - 05:00 PM"
    ];

    const bookedAppointments = await Appointment.find({
      doctorId: doctorIdHash,
      appointmentDate: date,
      status: { $in: ["Pending", "Approved", "Completed"] }
    });

    const bookedSlotsList = bookedAppointments.map(a => a.timeSlot);

    // Mark availability
    const now = new Date();
    const todayStr = now.toLocaleDateString('en-CA'); // YYYY-MM-DD in local time

    let standardizedInputDate = date;
    if (date.includes('-') && date.split('-')[0].length === 2) {
      const [d, m, y] = date.split('-');
      standardizedInputDate = `${y}-${m}-${d}`;
    }

    const isToday = standardizedInputDate === todayStr;
    const isPastDate = standardizedInputDate < todayStr;

    const slots = standardSlots.map(s => {
      let isAvailable = !bookedSlotsList.includes(s);

      if (isPastDate) {
        isAvailable = false;
      } else if (isToday && isAvailable) {
        try {
          const startTimeStr = s.split(" - ")[0];
          const [time, modifier] = startTimeStr.split(" ");
          let [hours, minutes] = time.split(":").map(Number);

          if (modifier === "PM" && hours < 12) hours += 12;
          if (modifier === "AM" && hours === 12) hours = 0;

          const slotTime = new Date();
          slotTime.setHours(hours, minutes, 0, 0);

          if (slotTime < now) {
            isAvailable = false;
          }
        } catch (e) {
          console.error("Error parsing slot time:", e);
        }
      }

      return {
        slot: s,
        isAvailable
      };
    });

    res.json(slots);
  } catch (err) {
    console.error("Error fetching slots:", err);
    res.status(500).send("Error fetching slots");
  }
});

// 3. Book Appointment
app.post("/bookAppointment", async (req, res) => {
  try {
    const {
      patientId, patientName,
      doctorId, doctorName,
      hospitalId, hospitalName,
      department, appointmentDate, timeSlot
    } = req.body;

    const patientIdHash = hashId(patientId);

    // Check if double booking happened
    const existing = await Appointment.findOne({
      doctorId, appointmentDate, timeSlot,
      status: { $in: ["Pending", "Approved", "Completed"] }
    });

    if (existing) return res.status(400).send("Slot already booked");

    const appointment = new Appointment({
      patientId: patientIdHash,
      patientName,
      doctorId,
      doctorName,
      hospitalId,
      hospitalName,
      department,
      appointmentDate,
      timeSlot
    });

    await appointment.save();
    res.status(201).send("Appointment Booked. Awaiting Approval.");
  } catch (err) {
    res.status(500).send("Booking failed: " + err.message);
  }
});

// 4. Get Appointments (Generic)
app.get("/getAppointments", async (req, res) => {
  try {
    const { userId, role } = req.query;
    if (!userId) return res.status(400).send("User ID required");

    const idHash = hashId(userId);
    let query = {};

    if (role === 'patient') query = { patientId: idHash };
    else if (role === 'doctor') query = { doctorId: idHash };
    else if (role === 'hospital') query = { hospitalId: userId }; // Hospital ID is not usually hashed in this project context

    const appointments = await Appointment.find(query).sort({ appointmentDate: 1, timeSlot: 1 });
    res.json(appointments);
  } catch (err) {
    res.status(500).send("Error fetching appointments");
  }
});

// 5. Update Appointment Status (Generates Visit Code on Approval)
app.post("/updateAppointmentStatus", async (req, res) => {
  try {
    const { appointmentId, status } = req.body;

    let updateData = { status };

    if (status === "Approved") {
      const appt = await Appointment.findById(appointmentId);
      if (!appt) return res.status(404).send("Appointment not found");

      // Generate a random 6-digit Visit Code
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const prefix = appt.hospitalId.substring(0, 3).toUpperCase();

      // Calculate Expiry: 2 Hours After Appointment End Time
      // Slot example: "09:00 AM - 10:30 AM"
      let expiryTime = new Date(Date.now() + 24 * 60 * 60 * 1000); // Fallback: 24h from now
      try {
        const slotParts = appt.timeSlot.split(" - ");
        if (slotParts.length === 2) {
          const endTimeStr = slotParts[1]; // "10:30 AM"
          const [time, modifier] = endTimeStr.split(" ");
          let [hours, minutes] = time.split(":");
          if (hours === "12") hours = "00";
          if (modifier === "PM") hours = parseInt(hours, 10) + 12;

          // Create date using YYYY-MM-DD + 24h time
          const dateStr = `${appt.appointmentDate}T${hours.toString().padStart(2, '0')}:${minutes}:00`;
          expiryTime = new Date(dateStr);
          // Add 2 Hours Buffer
          expiryTime.setHours(expiryTime.getHours() + 2);
        }
      } catch (err) {
        console.error("Scale Slot Parse Error:", err);
      }

      updateData.visitCode = `${prefix}-${code}`;
      updateData.visitCodeExpiry = expiryTime;
      updateData.visitCodeUsed = false;
    }

    await Appointment.findByIdAndUpdate(appointmentId, updateData);
    res.json({ message: `Appointment ${status}`, visitCode: updateData.visitCode });
  } catch (err) {
    console.error("Update Status Error:", err);
    res.status(500).send("Update failed");
  }
});

// 5.1 Verify Visit Code and Grant Temporary Access
app.post("/verifyVisitCode", async (req, res) => {
  try {
    const { visitCode, doctorId } = req.body;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    // Find valid approved appointment with this code
    const appt = await Appointment.findOne({
      visitCode,
      status: "Approved",
      // Removed visitCodeUsed: false to allow multiple verifications in window
      visitCodeExpiry: { $gt: new Date() }
    });

    if (!appt) {
      return res.status(400).send("Invalid or expired visit code.");
    }

    // [NEW] 24-Hour Lead Time Check
    // Token only works from 24 hours before the appointment start
    try {
      const slotParts = appt.timeSlot.split(" - ");
      const startTimeStr = slotParts[0]; // "09:00 AM"
      const [time, modifier] = startTimeStr.split(" ");
      let [hours, minutes] = time.split(":").map(Number);

      if (modifier === "PM" && hours !== 12) hours += 12;
      if (modifier === "AM" && hours === 12) hours = 0;

      const [year, month, day] = appt.appointmentDate.split("-").map(Number);
      const apptStartTime = new Date(year, month - 1, day, hours, minutes, 0);
      const validFrom = new Date(apptStartTime.getTime() - 24 * 60 * 60 * 1000);

      if (new Date() < validFrom) {
        return res.status(403).send(`Token not yet active. Access opens 24h before the appointment (${validFrom.toLocaleString()}).`);
      }
    } catch (err) {
      console.error("Start Time Security Check Error:", err);
      // If parsing fails, we allow (better than blocking a valid patient), but log it.
    }

    // Verify doctor belongs to the same hospital
    const doctorHash = hashId(doctorId);
    const doctorUser = await User.findOne({ userIdHash: doctorHash });

    if (!doctorUser || doctorUser.hospitalId !== appt.hospitalId) {
      return res.status(403).send("Authentication failed: Code belongs to a different hospital.");
    }

    // [MODIFIED] No longer marking as used immediately to allow valid re-entry
    // appt.visitCodeUsed = true;
    // await appt.save();

    // Grant temporary access in the system (Expiry same as Visit Code or 2h min)
    const accessExpiry = appt.visitCodeExpiry;
    const newAccess = new Access({
      patientId: appt.patientId,
      doctorId: doctorHash,
      type: "Visit Code",
      expiresAt: accessExpiry
    });
    await newAccess.save();

    // Audit Log
    const log = new AuditLog({
      doctorId: doctorHash,
      patientId: appt.patientId,
      action: "Visit Session Verified",
      hospitalId: appt.hospitalId,
      ipAddress: ip,
      details: `Visit Code ${visitCode} verified for session.`
    });
    await log.save();

    res.json({
      message: "Access Granted",
      patientId: appt.patientId, // Hash
      patientName: appt.patientName,
      expiry: accessExpiry
    });

  } catch (err) {
    console.error("Verify Code Error:", err);
    res.status(500).send("Verification failed");
  }
});

// 6. Get Today's Schedule for Doctor
app.get("/getDoctorSchedule/:doctorId/:date", async (req, res) => {
  try {
    const { doctorId, date } = req.params;
    const idHash = hashId(doctorId);

    const standardSlots = [
      "09:00 AM - 09:30 AM", "09:30 AM - 10:00 AM",
      "10:00 AM - 10:30 AM", "10:30 AM - 11:00 AM",
      "11:00 AM - 11:30 AM", "11:30 AM - 12:00 PM",
      "02:00 PM - 02:30 PM", "02:30 PM - 03:00 PM",
      "03:00 PM - 03:30 PM", "03:30 PM - 04:00 PM",
      "04:00 PM - 04:30 PM", "04:30 PM - 05:00 PM"
    ];

    const appointments = await Appointment.find({ doctorId: idHash, appointmentDate: date });

    const now = new Date();
    const todayStr = now.toLocaleDateString('en-CA');
    const isToday = date === todayStr;
    const isPastDate = date < todayStr;

    const schedule = standardSlots.map(s => {
      // Find all appointments for this slot
      const slotAppts = appointments.filter(a => a.timeSlot === s);

      // Prioritize active statuses over Rejected
      const appt = slotAppts.find(a => ["Approved", "Pending", "Completed"].includes(a.status))
        || slotAppts.find(a => a.status === "Rejected")
        || null;

      let status = appt ? appt.status : "Available";

      // If Available but in the past, mark as Closed
      if (status === "Available") {
        if (isPastDate) {
          status = "Closed";
        } else if (isToday) {
          try {
            const startTimeStr = s.split(" - ")[0];
            const [time, modifier] = startTimeStr.split(" ");
            let [hours, minutes] = time.split(":").map(Number);
            if (modifier === "PM" && hours < 12) hours += 12;
            if (modifier === "AM" && hours === 12) hours = 0;

            const slotTime = new Date();
            slotTime.setHours(hours, minutes, 0, 0);

            if (slotTime < now) {
              status = "Closed";
            }
          } catch (e) { }
        }
      }

      return {
        timeSlot: s,
        status: status,
        patientName: appt ? appt.patientName : "-",
        appointmentId: appt ? appt._id : null
      };
    });

    res.json(schedule);
  } catch (err) {
    res.status(500).send("Error fetching schedule");
  }
});

// Dev util to clear bad data
app.post("/reset", async (req, res) => {
  try {
    await User.deleteMany({});
    await Record.deleteMany({});
    await Access.deleteMany({});
    console.log("DB Reset via API");
    res.send("Database completely cleared. Please register again.");
  } catch (err) {
    res.status(500).send("Error clearing DB");
  }
});

/* -------- GLOBAL ERROR HANDLER -------- */
app.use((err, req, res, next) => {
  console.error("Global Error Handler:", err);
  res.status(500).send("Server Error: " + (err.message || "Unknown Error"));
});

/* -------- FORGOT PASSWORD FLOW -------- */

// 1. Generate and send OTP
app.post("/auth/forgot-password", async (req, res) => {
  try {
    let { userId, phone } = req.body;
    if (!userId || !phone) return res.status(400).send("User ID and Phone number are required");
    
    // Format to +91 if needed to match DB
    phone = phone.trim();
    if (phone.length === 10 && !phone.startsWith('+')) {
      phone = '+91' + phone;
    }

    // Check if user exists matching BOTH ID and Phone
    const user = await User.findOne({ userId: userId.trim(), phone });
    if (!user) {
      return res.status(404).json({ success: false, message: "Mobile number is not registered." });
    }

    // Connect to Twilio for SMS
    if (twilioClient && TWILIO_VERIFY_SERVICE_SID) {
      console.log(`[TWILIO] Sending real Forgot Password OTP SMS to ${phone}...`);
      await twilioClient.verify.v2.services(TWILIO_VERIFY_SERVICE_SID)
        .verifications
        .create({ to: phone, channel: 'sms' });
      
      // We still mark it in otpService just to track state for /reset-password if needed
      generateOTP(phone); 

      return res.json({ success: true, message: `Real OTP SMS sent via Twilio to ${phone}. Expiring in 5 minutes.` });
    } else {
      // Fallback to Developer Demo Mode if Twilio is basically off
      const otp = generateOTP(phone);
      console.log(`\n================================`);
      console.log(`[FORGOT PASSWORD OTP]`);
      console.log(`OTP FOR: ${phone}`);
      console.log(`CODE:    ${otp}`);
      console.log(`================================\n`);
      return res.json({ success: true, message: `OTP sent locally (Twilio Disabled). Check console.` });
    }

  } catch (err) {
    console.error("Forgot Password Error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// 2. Verify OTP
app.post("/auth/verify-otp", async (req, res) => {
  try {
    let { phone, otp } = req.body;
    if (!phone || !otp) return res.status(400).send("Phone and OTP are required");

    phone = phone.trim();
    if (phone.length === 10 && !phone.startsWith('+')) phone = '+91' + phone;

    let twilioVerified = false;

    // A. Check Twilio First (If Connected)
    if (twilioClient && TWILIO_VERIFY_SERVICE_SID) {
      try {
        const verificationCheck = await twilioClient.verify.v2.services(TWILIO_VERIFY_SERVICE_SID)
          .verificationChecks
          .create({ to: phone, code: otp.trim() });
          
        if (verificationCheck.status === 'approved') {
          twilioVerified = true;
          // Twilio successfully verified them! Let's force our local store to agree securely.
          forceVerify(phone);
          return res.json({ success: true, message: "OTP Verified securely via Twilio SMS." });
        }
      } catch (err) {
        console.error(`[TWILIO ERROR] Invalid Code: ${err.message}`);
        // Do not abort here, we drop down to our local fallback if they used Demo Mode.
      }
    }

    // B. Check Local Memory Fallback (If Twilio was disabled/bypassed)
    if (!twilioVerified) {
       const result = verifyOTP(phone, otp.trim());
       if (result.valid) {
         return res.json({ success: true, message: result.message });
       } else {
         return res.status(400).json({ success: false, message: result.message || "Invalid OTP Code." });
       }
    }

  } catch (err) {
    console.error("OTP Verification Error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// 3. Reset Password
app.post("/auth/reset-password", async (req, res) => {
  try {
    let { userId, phone, newPassword } = req.body;
    if (!userId || !phone || !newPassword) return res.status(400).send("User ID, Phone, and new password are required");

    phone = phone.trim();
    if (phone.length === 10 && !phone.startsWith('+')) phone = '+91' + phone;

    // IMPORTANT: Verify that this session successfully verified the OTP
    if (!isVerified(phone)) {
      return res.status(403).json({ success: false, message: "Unauthorized. OTP verification required." });
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // Update User Document matching BOTH ID and Phone
    const user = await User.findOneAndUpdate(
      { userId: userId.trim(), phone },
      { password: hashedNewPassword },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    // Security: Clear OTP so it cannot be reused
    clearOTP(phone);

    res.json({ success: true, message: "Password dynamically reset successfully." });

  } catch (err) {
    console.error("Reset Password Error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

/* -------- ONLINE SSL CERTIFICATE CONFIGURATION -------- */
const https = require("https");

// Define paths where you will place the downloaded files from ZeroSSL / Let's Encrypt
const sslDir = path.join(__dirname, "ssl");
const certPath = path.join(sslDir, "certificate.crt");
const keyPath = path.join(sslDir, "private.key");

let serverMode = "HTTP";
let onlineCertData = null;
let serverInstance;

if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
  console.log("[SSL] Real online SSL certificates found! Switching to HTTPS.");
  serverMode = "HTTPS";
  
  // Read certificate files
  const certDetails = fs.readFileSync(certPath);
  const keyDetails = fs.readFileSync(keyPath);
  
  // Parse real certificate details using Node.js Crypto X509 (Available in modern Node)
  try {
    const x509 = new crypto.X509Certificate(certDetails);
    
    // Extract Name (Organization or Issuer Name dynamically)
    let issuerName = x509.issuer.split('\n').find(l => l.startsWith('O='));
    let fallbackName = x509.issuer.split('\n').find(l => l.startsWith('CN='));
    
    onlineCertData = {
      name: (issuerName ? issuerName.substring(2) : (fallbackName ? fallbackName.substring(3) : "External SSL Authority")) + " (Verified)",
      hashDisplay: x509.fingerprint256.substring(0, 32) + "...",
      hashFull: x509.fingerprint256,
      pubKey: x509.publicKey.export({ type: 'spki', format: 'pem' }).substring(0, 60) + "...",
      issuedOn: new Date(x509.validFrom).toLocaleString(),
      expiresOn: new Date(x509.validTo).toLocaleString()
    };
  } catch (err) {
    console.error("[SSL WARN] Could not parse certificate metadata:", err.message);
  }

  // Create Secure Server
  const options = { key: keyDetails, cert: certDetails };
  serverInstance = https.createServer(options, app);

} else {
  console.log("[SSL] Online certificates not found in /ssl folder. Running in standard HTTP mode.");
  serverInstance = app; // standard Express
}


/* -------- CERTIFICATE EXPORT API -------- */
app.get("/api/certificate-data", (req, res) => {
  try {
    // If real SSL certificate is configured, return the REAL validated data automatically
    if (onlineCertData) {
      return res.json(onlineCertData);
    }

    // Fallback: Digest the loaded RSA public key to prove mathematical linkage (like before)
    const hash = crypto.createHash('sha256').update(publicKey).digest('hex');
    const displayHash = hash.substring(0, 32) + "...";
    
    res.json({
      name: "SecureEHR Mock Authority (Awaiting Online SSL)",
      hashDisplay: displayHash,
      hashFull: hash,
      pubKey: hash, 
      issuedOn: new Date().toLocaleString(),
      expiresOn: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000).toLocaleString()
    });
  } catch (err) {
    res.status(500).send("Error fetching cryptographic details");
  }
});

const PORT = process.env.PORT || 3000;
serverInstance.listen(PORT, () => {
  console.log(`Secure EHR Server running on port ${PORT} [Mode: ${serverMode}]`);
});
