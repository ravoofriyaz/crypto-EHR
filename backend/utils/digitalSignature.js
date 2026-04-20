const crypto = require("crypto");

/**
 * Signs data using an RSA private key.
 * @param {string} data - The data (hash) to be signed.
 * @param {string} privateKey - RSA Private Key.
 * @returns {string} - Base64 encoded digital signature.
 */
function signData(data, privateKey) {
    const sign = crypto.createSign("SHA256");
    sign.update(data);
    sign.end();
    return sign.sign(privateKey, "base64");
}

/**
 * Verifies a digital signature using an RSA public key.
 * @param {string} data - The data (hash) that was signed.
 * @param {string} signature - Base64 encoded digital signature.
 * @param {string} publicKey - RSA Public Key.
 * @returns {boolean} - True if verification succeeds.
 */
function verifyData(data, signature, publicKey) {
    const verify = crypto.createVerify("SHA256");
    verify.update(data);
    verify.end();
    return verify.verify(publicKey, signature, "base64");
}

module.exports = {
    signData,
    verifyData
};
