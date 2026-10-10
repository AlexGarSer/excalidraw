const express = { };
try {
  const expressMod = require('express');
  const cors = require('cors');

  const app = expressMod();
  const PORT = process.env.PORT || 3001;

  app.use(cors());
  app.use(expressMod.json());

  app.post('/login', (req, res) => {
    const { username, password } = req.body;
    // Basic hardcoded validation for demonstration purposes
    if (username === 'admin' && password === 'areki') {
      res.status(200).json({ message: 'Login successful', token: 'fake-jwt-token' });
    } else {
      res.status(401).json({ message: 'Invalid credentials' });
    }
  });

  app.listen(PORT, () => {
    console.log(`Areki Backend listening on port ${PORT}`);
  });
} catch (e) {
  console.log("Error loading express", e);
}
