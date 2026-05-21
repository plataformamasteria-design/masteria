import fs from 'fs';

async function test() {
  try {
    const res = await fetch("http://localhost:3000/api/meta/insights?account_id=act_1107588781525178&level=campaign", {
      headers: {
        "Content-Type": "application/json"
      }
    });
    
    const text = await res.text();
    console.log("Status:", res.status);
    console.log("Response:", text);
  } catch (err) {
    console.error("Fetch failed:", err);
  }
}

test();
