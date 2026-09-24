import http from 'http';

const data = JSON.stringify({
  username: 'alexas',
  password: 'alexas002'
});

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, res => {
  console.log(`STATUS: ${res.statusCode}`);
  
  let body = '';
  res.on('data', d => {
    body += d;
  });
  
  res.on('end', () => {
    console.log('RESPONSE:', body);
  });
});

req.on('error', error => {
  console.error('Error:', error);
});

req.write(data);
req.end();
