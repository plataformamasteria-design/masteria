const { execSync } = require('child_process');

try {
  const output = execSync('netstat -ano | findstr LISTENING').toString();
  const lines = output.split('\n');
  const portsToKill = ['3000', '3001', '3333', '4000', '8000', '8080'];
  let killed = 0;
  let pidsToKill = new Set();
  
  for (const line of lines) {
    for (const port of portsToKill) {
       if (line.includes(`:${port} `) || line.includes(`[::]:${port} `)) {
          const parts = line.trim().split(/\s+/);
          const pid = parts[parts.length - 1];
          if (pid && !isNaN(parseInt(pid)) && pid !== '0') {
             pidsToKill.add(pid);
          }
       }
    }
  }

  for (const pid of pidsToKill) {
     console.log(`Killing process ${pid}...`);
     try {
       execSync(`taskkill /PID ${pid} /F`);
       killed++;
     } catch(e) {}
  }

  if (killed === 0) {
     console.log("No local servers found running on development ports.");
  } else {
     console.log(`Successfully killed ${killed} server process(es).`);
  }
} catch (error) {
  console.log("Could not list processes", error.message);
}
