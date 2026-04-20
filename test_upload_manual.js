const http = require('http');
const fs = require('fs');
const path = require('path');

// Basic manual multipart/form-data request generator
// because we might not have 'form-data' package
function postRecord() {
    const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';

    // Construct body
    let body = '';
    body += `--${boundary}\r\n`;
    body += 'Content-Disposition: form-data; name="patientId"\r\n\r\n';
    body += 'P1001\r\n';

    body += `--${boundary}\r\n`;
    body += 'Content-Disposition: form-data; name="disease"\r\n\r\n';
    body += 'Test Flu\r\n';

    body += `--${boundary}\r\n`;
    body += 'Content-Disposition: form-data; name="reason"\r\n\r\n';
    body += 'Testing\r\n';

    body += `--${boundary}\r\n`;
    body += 'Content-Disposition: form-data; name="precautions"\r\n\r\n';
    body += 'None\r\n';

    body += `--${boundary}\r\n`;
    body += 'Content-Disposition: form-data; name="medicines"\r\n\r\n';
    body += 'None\r\n';

    // File part (empty or small content)
    body += `--${boundary}\r\n`;
    body += 'Content-Disposition: form-data; name="file"; filename="test.txt"\r\n';
    body += 'Content-Type: text/plain\r\n\r\n';
    body += 'Hello World Content\r\n';

    body += `--${boundary}--\r\n`;

    const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/addRecord',
        method: 'POST',
        headers: {
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            'Content-Length': Buffer.byteLength(body)
        }
    };

    const req = http.request(options, (res) => {
        console.log(`STATUS: ${res.statusCode}`);
        res.setEncoding('utf8');
        let fullBody = '';
        res.on('data', (chunk) => {
            fullBody += chunk;
        });
        res.on('end', () => {
            console.log(`BODY: ${fullBody}`);
        });
    });

    req.on('error', (e) => {
        console.error(`problem with request: ${e.message}`);
    });

    // Write data to request body
    req.write(body);
    req.end();
}

postRecord();
