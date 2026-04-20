
const blockchain = require('./backend/blockchain.js');

async function test() {
    try {
        console.log("Testing Blockchain Module...");
        const account = await blockchain.getAccount();
        console.log("Account found:", account);
        if (account) {
            console.log("Blockchain module is working correctly.");
        } else {
            console.error("Blockchain module returned no account.");
            process.exit(1);
        }
    } catch (error) {
        console.error("Error:", error);
        process.exit(1);
    }
}

test();
