const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Ensure keys directory exists
const keysDir = path.join(__dirname, 'keys');
if (!fs.existsSync(keysDir)) {
    fs.mkdirSync(keysDir);
}

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
    },
    privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
    }
});

fs.writeFileSync(path.join(keysDir, 'public.pem'), publicKey);
fs.writeFileSync(path.join(keysDir, 'public.pem'), publicKey);

console.log('--- RSA Key Pair Generated ---');
console.log('✅ Public Key saved to:', path.join(keysDir, 'public.pem'));
console.log('\n🔐 PRIVATE KEY (Copy this into your .env as PRIVATE_KEY=)');
console.log('------------------------------------------------------');
console.log(privateKey.replace(/\r?\n/g, '\\n'));
console.log('------------------------------------------------------');
console.log('\n⚠️  SECURITY WARNING: Never commit your private key! Keep it in .env only.');
