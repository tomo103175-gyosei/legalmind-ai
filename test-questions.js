const fs = require('fs');

async function testQuestions() {
  try {
    const res = await fetch('http://localhost:3000/api/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        questionText: "Test Question",
        optionsJson: "[\"A\", \"B\"]",
        userId: "test-user"
      })
    });
    
    console.log("Status:", res.status);
    const data = await res.text();
    console.log("Data:", data);
  } catch(e) {
    console.error(e);
  }
}

testQuestions();
