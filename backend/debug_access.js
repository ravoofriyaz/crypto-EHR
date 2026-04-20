// Using native fetch in Node 18+
// If node-fetch is not available, we can use http/https modules but fetch is easier.
// Assuming node 18+ which has native fetch.

const API_URL = "http://localhost:3000";

const PATIENT_ID = "DEBUG_PATIENT_" + Date.now();
const DOCTOR_ID = "DEBUG_DOCTOR_" + Date.now();
const PASSWORD = "password123";

async function run() {
    console.log("=== Debugging Access Control ===");

    // 1. Register Patient
    console.log(`\n1. Registering Patient: ${PATIENT_ID}`);
    let res = await fetch(`${API_URL}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: PATIENT_ID, name: "Debug Patient", password: PASSWORD, role: "patient", phone: "1234567890" })
    });
    console.log("Register Patient Status:", res.status, await res.text());

    // 2. Register Doctor
    console.log(`\n2. Registering Doctor: ${DOCTOR_ID}`);
    res = await fetch(`${API_URL}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: DOCTOR_ID, name: "Debug Doctor", password: PASSWORD, role: "doctor", hospital: "Debug Hospital" })
    });
    console.log("Register Doctor Status:", res.status, await res.text());

    // 3. Grant Access
    console.log(`\n3. Granting Access...`);
    res = await fetch(`${API_URL}/grantAccess`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId: PATIENT_ID, doctorId: DOCTOR_ID })
    });
    console.log("Grant Access Status:", res.status, await res.text());

    // 4. Fetch Access List
    console.log(`\n4. Fetching Access List for ${PATIENT_ID}...`);
    res = await fetch(`${API_URL}/getAccessList/${PATIENT_ID}`);
    console.log("Fetch Status:", res.status);

    if (res.ok) {
        const list = await res.json();
        console.log("Access List:", JSON.stringify(list, null, 2));

        if (list.length > 0) {
            const fetchedDoctorId = list[0].doctorId;
            console.log(`   -> Found Doctor ID in list: ${fetchedDoctorId}`);

            // 5. Revoke Access
            console.log(`\n5. Revoking Access for ${fetchedDoctorId}...`);
            res = await fetch(`${API_URL}/revokeAccess`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ patientId: PATIENT_ID, doctorId: fetchedDoctorId })
            });
            console.log("Revoke Access Status:", res.status, await res.text());

            // 6. Verify Revocation
            console.log(`\n6. Verifying Revocation...`);
            res = await fetch(`${API_URL}/getAccessList/${PATIENT_ID}`);
            const updatedList = await res.json();
            console.log("Updated Access List:", JSON.stringify(updatedList, null, 2));
            if (updatedList.length === 0) {
                console.log("SUCCESS: Access revoked.");
            } else {
                console.log("FAILURE: Access still exists.");
            }

        } else {
            console.log("FAILURE: Access list is empty but should have 1 doctor.");
        }
    } else {
        console.log("FAILURE: Could not fetch access list.");
        console.log("Error Body:", await res.text());
    }
}

run().catch(err => console.error(err));
