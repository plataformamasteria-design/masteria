import fs from 'fs';

async function test() {
  try {
    const res = await fetch("http://localhost:3000/api/meta/insights?level=ad&breakdown=none", {
      headers: {
        "Content-Type": "application/json",
        // Need to simulate a session or just bypass it for local testing if possible.
        // Actually I can't bypass without modifying route.ts.
      }
    });
    
    console.log("Status:", res.status);
    const data = await res.json();
    console.log(data?.data?.slice(0, 2));
  } catch (err) {
    console.error("Fetch failed:", err);
  }
}

test();
