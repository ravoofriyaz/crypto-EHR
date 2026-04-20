# Optimized Bio-ECC-AES Framework: A Hybrid Cryptographic Model for Secure and Emergency-Accessible Electronic Health Records

**Md Ravoof Riyaz, U Mythri, V Puneeth Kumar, S Siva Surya Teja**
Department of Computer Science and Engineering
Ramachandra Engineering College, Eluru, India
{22me1a0533, 22me1a0562, 22me1a0563, 22me1a0554}@rec.edu.in

**Mrs. B. Rajeswari**
Assistant Professor
Department of Computer Science and Engineering
Ramachandra Engineering College, Eluru, India
rajeswari.b@rec.edu.in

---

### Abstract
**Electronic Health Records (EHRs) have reshaped healthcare delivery by replacing paper-based documentation with centralized digital systems that enable rapid access to patient information. Despite these benefits, concerns surrounding privacy, data breaches, and computational overhead remain significant barriers to widespread adoption—especially in mobile and resource-constrained environments. Traditional hybrid cryptographic frameworks, particularly those combining AES and RSA, enhance confidentiality but often introduce substantial processing latency. In some reported implementations, encrypting a 500 KB medical record requires over five seconds, making real-time clinical usage inefficient.**

**This study presents an optimized Bio-ECC-AES hybrid framework designed to improve both performance and emergency accessibility without compromising security. The proposed model replaces RSA-2048 with Elliptic Curve Cryptography (ECC-256) for key exchange, achieving equivalent cryptographic strength with dramatically reduced computational cost. Experimental evaluation demonstrates a reduction in key generation time from 1240.28 ms to 5.16 ms. Additionally, AES-GCM is employed instead of separate AES-CBC and SHA-256 modules, enabling authenticated encryption in a single operation and improving encryption efficiency by 16.26%.**

**Beyond performance enhancements, the framework introduces an emergency “Break-Glass” mechanism based on Fuzzy Vault bio-cryptography. This allows secure recovery of decryption keys using patient biometrics during critical situations where explicit consent cannot be obtained. Implemented using a Node.js and MongoDB architecture, the system supports encrypted storage of diverse medical formats, including PDF and JPG files. The results indicate that the proposed framework offers a high-performance, scalable, and patient-centric alternative to legacy hybrid EHR security models.**

**Keywords:** Cryptography, Bio-ECC-AES, Electronic Health Records (EHR), Fuzzy Vault, AES-GCM.

---

## I. INTRODUCTION
The digital transformation of healthcare has led to the widespread adoption of Electronic Health Records (EHRs), replacing traditional paper-based medical documentation. By consolidating laboratory results, imaging reports, prescriptions, and clinical notes into unified digital systems, EHRs enhance efficiency, reduce administrative errors, and improve continuity of care. However, the same centralization that makes EHR systems convenient also makes them attractive targets for cyberattacks.

Healthcare data is particularly sensitive. Unauthorized disclosure can lead not only to privacy violations but also to discrimination, reputational damage, and financial harm for patients. As a result, ensuring confidentiality, integrity, and controlled access has become a foundational requirement of modern EHR architectures.

Hybrid cryptographic models have emerged as a practical solution to these challenges. A widely adopted approach combines the Advanced Encryption Standard (AES) for data encryption with the Rivest–Shamir–Adleman (RSA) algorithm for secure key exchange. While this AES-RSA model strengthens security compared to standalone encryption methods, it introduces measurable computational overhead. Prior evaluations report encryption processing times exceeding five seconds for moderately sized medical records (500 KB), along with increased memory consumption. Such delays are problematic in mobile healthcare applications and emergency clinical workflows, where timely access to information is critical.

Another limitation of conventional EHR security frameworks is their reliance on rigid role-based access control. Although effective for routine operations, static access policies can obstruct urgent treatment when patients are unconscious or otherwise unable to provide authorization. In emergency medicine, delays caused by encryption barriers may compromise patient outcomes.

To address these concerns, this research proposes an optimized Bio-ECC-AES hybrid framework. The model replaces RSA-2048 with Elliptic Curve Cryptography (ECC-256), significantly reducing key management latency while maintaining equivalent security strength. Furthermore, AES-GCM is adopted to provide integrated confidentiality and integrity verification within a single cryptographic process. In addition, a biometric “Break-Glass” mechanism based on the Fuzzy Vault scheme is incorporated to enable secure emergency access through patient biometrics.

By combining performance optimization with emergency-ready functionality, the proposed framework aims to deliver a secure, scalable, and practical solution for next-generation EHR systems.

---

## II. RELATED WORK
The protection of medical information has long been a central concern in healthcare informatics. As hospitals transitioned from paper-based documentation to electronic record systems, researchers began exploring cryptographic mechanisms capable of safeguarding highly sensitive patient data. Over time, various approaches have been proposed to balance confidentiality, integrity, accessibility, and computational efficiency. This section reviews key developments relevant to the proposed Bio-ECC-AES framework.

### A. Hybrid AES-RSA Cryptographic Models
One of the most widely studied approaches for securing Electronic Health Records involves combining symmetric and asymmetric cryptography. In such hybrid systems, the Advanced Encryption Standard (AES) is used to encrypt patient data due to its speed and efficiency, while the Rivest-Shamir-Adleman (RSA) algorithm is employed for secure key exchange. This AES-RSA combination improves confidentiality compared to single-algorithm solutions and has been shown to provide strong protection against unauthorized access.

However, performance analyses of these systems reveal certain limitations. While encryption strength is enhanced, RSA-based key management introduces noticeable latency. Empirical evaluations indicate that processing moderately sized medical files (approximately 500 KB) can require several seconds, particularly during key generation and encryption phases. This computational cost becomes more pronounced in mobile or resource-constrained environments, where processing power and battery capacity are limited. As a result, the AES-RSA model, although secure, does not fully resolve the security-performance trade-off.

### B. Bio-Cryptography and Biometric Key Protection
Beyond traditional encryption models, researchers have explored integrating biometric characteristics into cryptographic systems. Bio-cryptography leverages unique human traits—such as fingerprints or iris patterns—to secure or reconstruct encryption keys. Techniques such as the fuzzy vault and fuzzy commitment schemes bind cryptographic secrets to biometric feature sets, making key recovery dependent on legitimate biological input.

Studies in this domain demonstrate promising resistance against impersonation attacks, often reporting negligible false acceptance rates when implemented under controlled conditions. These approaches are particularly attractive for healthcare systems because they align with patient-centric authentication models. However, many implementations focus primarily on authentication rather than integrating biometric mechanisms into broader hybrid encryption frameworks.

### C. Attribute-Based Encryption for Medical Records
Another line of research addresses flexible access control through Attribute-Based Encryption (ABE). In ABE systems, decryption rights are associated with user attributes rather than predefined roles. This allows more dynamic access policies and supports fine-grained permission structures within medical institutions. ABE has been applied to mobile healthcare environments, enabling patients to manage their own encrypted records while granting selective access to healthcare providers.

Despite its flexibility, ABE often introduces additional computational complexity, especially during key generation and policy enforcement. Furthermore, most evaluations emphasize encryption and decryption timings without comprehensively assessing memory consumption or scalability within real-world hospital infrastructures.

### D. Lightweight and Elliptic Curve Cryptography Approaches
To reduce computational overhead, recent studies have explored lightweight cryptographic alternatives. Elliptic Curve Cryptography (ECC) has gained particular attention due to its ability to provide equivalent security strength with significantly smaller key sizes compared to RSA. By relying on the mathematical difficulty of the Elliptic Curve Discrete Logarithm Problem (ECDLP), ECC achieves strong protection while reducing processing time and storage requirements.

Comparative analyses consistently demonstrate that ECC-based key exchange mechanisms outperform RSA in terms of efficiency. These characteristics make ECC especially suitable for mobile healthcare applications and Internet-of-Medical-Things (IoMT) environments, where computational resources are constrained. Nevertheless, many existing frameworks implement ECC primarily for key exchange without integrating optimized authenticated encryption modes or emergency-access provisions.

### E. Identified Research Gap
Although substantial progress has been made in securing electronic medical records, existing solutions often require a compromise between strong security and operational efficiency. Hybrid AES-RSA systems provide robust encryption but suffer from latency issues. Biometric methods enhance authentication but are rarely incorporated into full-scale hybrid architectures. Attribute-based models improve flexibility yet introduce additional complexity. Meanwhile, many systems lack a practical and secure emergency-access mechanism for situations in which patients cannot provide consent.

The proposed Bio-ECC-AES framework addresses these limitations by combining three key elements: the efficiency of ECC-based key exchange, the integrated authenticated encryption of AES-GCM, and a biometric break-glass mechanism based on the fuzzy vault scheme. By merging performance optimization with emergency accessibility, the framework aims to bridge the gap between theoretical cryptographic strength and real-world clinical practicality.

---

## III. PROPOSED METHODOLOGY

### A. System Overview
The proposed framework introduces a secure and performance-optimized architecture for protecting Electronic Health Records (EHRs). The design integrates efficient asymmetric key exchange, authenticated symmetric encryption, and biometric-based emergency recovery into a unified model. The objective is to ensure confidentiality, integrity, availability, and controlled emergency access without imposing excessive computational overhead.

The architecture consists of five primary layers:
- **User Interface Layer:** Used by patients, doctors, and administrators for authentication and record access.
- **Authentication Layer:** Handles identity verification using credentials and biometric validation.
- **Cryptographic Processing Layer:** Performs key exchange, encryption, decryption, and integrity verification.
- **Secure Storage Layer:** Stores encrypted EHR data in the cloud or hospital server.
- **Emergency Break-Glass Module:** Enables controlled access during critical medical situations.

Each component is designed to operate independently yet cohesively within the system’s overall security workflow.

### B. Cryptographic Framework Design
**1) Key Exchange using Elliptic Curve Cryptography (ECC):** To minimize computational overhead while maintaining strong security, the system employs Elliptic Curve Cryptography for secure session key establishment. ECC provides equivalent security to RSA with significantly smaller key sizes, reducing both processing time and memory usage.

The security of ECC is based on the Elliptic Curve Discrete Logarithm Problem (ECDLP), which is computationally infeasible to solve using classical computing techniques.
The elliptic curve equation used is:
*y^2 = x^3 + ax + b (mod p)* (1)
Where:
- *a* and *b* are curve parameters,
- *p* is a large prime number,
- The curve satisfies the condition: *4a^3 + 27b^2 ≠ 0 (mod p)*

A shared secret session key is generated through Elliptic Curve Diffie-Hellman (ECDH), ensuring that encryption keys are never transmitted directly.

**2) Data Encryption using AES-GCM:** After secure key establishment, patient records are encrypted using Advanced Encryption Standard (AES) in Galois/Counter Mode (GCM).
AES-GCM is selected because it provides:
- Confidentiality (via symmetric encryption)
- Integrity (via authentication tag)
- Protection against replay attacks
- Reduced computational passes (encryption + authentication in one step)

The AES encryption process can be expressed as:
*C = AES_K(P)* (2)
Where:
- *P* is the plaintext medical record,
- *K* is the session key derived from ECC,
- *C* is the ciphertext.

The GCM authentication tag ensures that any tampering with encrypted medical data is immediately detected during decryption.

**3) Secure Storage Model:** Encrypted records are stored in a cloud or hospital database in ciphertext form. The system never stores plaintext data on persistent storage. Each stored record includes:
- Encrypted medical file
- Associated authentication tag
- Metadata (timestamp, record ID)
- Encrypted session key (protected via ECC)

This ensures that even if the storage server is compromised, attackers cannot retrieve meaningful information without the corresponding private key.

### C. Biometric Break-Glass Mechanism
**1) Rationale for Emergency Access:** In medical emergencies, patients may be unconscious or unable to provide consent. Traditional encryption models prevent access under such conditions, potentially delaying life-saving treatment. To address this limitation, the framework incorporates a controlled break-glass mechanism secured through biometric cryptography.

**2) Fuzzy Vault-Based Key Recovery:** The system employs a fuzzy vault scheme to bind a cryptographic secret with a patient’s biometric template (e.g., fingerprint).
The process consists of:
- Extracting biometric feature points.
- Encoding the encryption key as a polynomial.
- Locking the polynomial using genuine biometric features mixed with random chaff points.

Vault locking process:
*V = {(x_i, P(x_i))} U "Chaff Points"* (3)
Where:
- *P(x)* represents a polynomial encoding the secret key.
- Genuine feature points unlock the vault.
- Chaff points obscure the structure to prevent brute-force reconstruction.

During emergency access:
- A doctor submits biometric input.
- If sufficient genuine feature overlap exists, the vault reconstructs the polynomial.
- The recovered key decrypts the EHR.
All emergency accesses are logged and audited to prevent misuse.

### D. Authentication and Access Control
The system implements multi-factor authentication consisting of:
- Username and password verification
- Biometric authentication
- Role-based access control (RBAC)

Access privileges are categorized as:
- Patient-level access
- Physician-level access
- Administrative-level access
- Emergency override access

This layered approach ensures that users can only access records within their authorization scope.

### E. System Workflow
The operational workflow follows five stages:
**Stage 1: Registration**
- User registers with credentials and biometric template.
- ECC key pair is generated.
- Biometric data is transformed into vault representation.

**Stage 2: Record Upload**
- EHR is encrypted using AES-GCM.
- Session key secured via ECC.
- Ciphertext stored in secure database.

**Stage 3: Normal Access**
- User authentication verified.
- ECC session key reconstructed.
- AES decryption performed.
- Integrity validated through authentication tag.

**Stage 4: Emergency Access**
- Doctor initiates break-glass request.
- Biometric vault unlocked.
- Key reconstructed.
- Access granted and logged.

**Stage 5: Audit and Monitoring**
- All operations logged.
- Suspicious activity triggers alerts.

### F. Threat Mitigation Strategy
The proposed methodology directly addresses major threat vectors as shown in Table I.

**TABLE I: Threat Mitigation Strategy**

| Threat | Mitigation Mechanism |
|---|---|
| Data breach | AES-GCM encryption |
| Man-in-the-middle attack | ECC secure key exchange |
| Replay attack | GCM authentication tag |
| Insider misuse | Role-based access control + audit logs |
| Unauthorized emergency access | Biometric fuzzy vault |
| Data tampering | Integrated integrity verification |
