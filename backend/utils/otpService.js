const otpStore = new Map();

const OTP_EXPIRY_MINUTES = 5;
const MAX_ATTEMPTS = 3;

/**
 * Generates a 6-digit OTP and stores it with expiry and attempt trackers.
 */
function generateOTP(phone) {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000;
    
    otpStore.set(phone, {
        otp,
        expiresAt,
        attempts: 0,
        verified: false
    });
    
    return otp;
}

/**
 * Verifies the OTP, checks expiry, limits attempts.
 */
function verifyOTP(phone, code) {
    const record = otpStore.get(phone);
    if (!record) return { valid: false, message: "No OTP requested for this number." };
    if (Date.now() > record.expiresAt) {
        otpStore.delete(phone);
        return { valid: false, message: "OTP has expired. Request a new one." };
    }
    if (record.attempts >= MAX_ATTEMPTS) {
        otpStore.delete(phone);
        return { valid: false, message: "Maximum attempts reached. Request a new OTP." };
    }
    
    if (record.otp !== code) {
        record.attempts += 1;
        return { valid: false, message: "Invalid OTP." };
    }
    
    // Mark as verified to allow password reset
    record.verified = true;
    return { valid: true, message: "OTP verified successfully." };
}

/**
 * Checks if a phone number's OTP was successfully verified for a reset phase.
 */
function isVerified(phone) {
    const record = otpStore.get(phone);
    if (record && record.verified && Date.now() <= record.expiresAt) {
        return true;
    }
    return false;
}

/**
 * Clears the OTP record after successful use or cancellation.
 */
function clearOTP(phone) {
    otpStore.delete(phone);
}

/**
 * Manually forces the verification state to true (used when Twilio validates independently)
 */
function forceVerify(phone) {
    const expiresAt = Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000;
    otpStore.set(phone, {
        otp: "TWILIO_OVERRIDE",
        expiresAt,
        attempts: 0,
        verified: true
    });
}

module.exports = {
    generateOTP,
    verifyOTP,
    isVerified,
    clearOTP,
    forceVerify
};
