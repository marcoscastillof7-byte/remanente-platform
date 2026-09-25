import http from 'http';

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/historical-details/1',
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
  }
};

const req = http.request(options, res => {
  console.log(`STATUS: ${res.statusCode}`);
  res.on('data', d => {
    process.stdout.write(d);
  });
});

req.on('error', error => {
  console.error(error);
});

req.write(JSON.stringify({ content: 'Test' }));
req.end();
