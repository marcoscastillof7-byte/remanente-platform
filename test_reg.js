async function run() {
    console.log("Iniciando prueba...");
    const res = await fetch('http://localhost:3001/api/auth/register', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({username: 'newuser1', password: 'abc', email: 'test@test.com'})
    });
    console.log(res.status);
    console.log(await res.text());
}
run();
