const fs = require('fs');

async function testUpload() {
  const formData = new FormData();
  // Create a 1x1 transparent PNG blob for testing
  const pngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
  const binary = Buffer.from(pngBase64, 'base64');
  const blob = new Blob([binary], { type: 'image/png' });
  formData.append('image', blob, 'test.png');

  try {
    const res = await fetch('http://localhost:3000/api/ocr', {
      method: 'POST',
      body: formData
    });
    
    console.log("Status:", res.status);
    const data = await res.text();
    console.log("Data:", data);
  } catch(e) {
    console.error(e);
  }
}

testUpload();
