const http = require('http');

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/reset',
    method: 'POST'
};

const req = http.request(options, res => {
    console.log(`StatusCode: ${res.statusCode}`);
    res.on('data', d => {
        process.stdout.write(d);
    });
});

req.on('error', error => {
    console.error(error);
});

req.end();
