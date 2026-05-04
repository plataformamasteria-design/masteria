const { execSync } = require('child_process');

try {
  const output = execSync('wmic process where "name=\'node.exe\'" get ProcessId,CommandLine').toString();
  const lines = output.split('\n');
  let killed = 0;
  for (const line of lines) {
    if (line.includes('next') || line.includes('nodemon') || line.includes('ts-node') || line.includes('tsx') || line.includes('start-railway')) {
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && !isNaN(parseInt(pid))) {
         console.log(`Killing Node process ${pid}: ${line.substring(0, 50)}...`);
         try {
           execSync(`taskkill /PID ${pid} /F`);
           killed++;
         } catch(e) {}
      }
    }
  }
  
  try {
     const goOutput = execSync('wmic process where "name=\'whatsmeow-service.exe\' or name=\'baileys.exe\'" get ProcessId,CommandLine').toString();
     const goLines = goOutput.split('\n');
     for (const line of goLines) {
       const parts = line.trim().split(/\s+/);
       const pid = parts[parts.length - 1];
       if (pid && !isNaN(parseInt(pid))) {
         console.log(`Killing Go process ${pid}: ${line.substring(0, 50)}...`);
         try {
           execSync(`taskkill /PID ${pid} /F`);
           killed++;
         } catch(e) {}
       }
     }
  } catch(e) {}

  if (killed === 0) {
     console.log("No local servers found running.");
  } else {
     console.log(`Successfully killed ${killed} server process(es).`);
  }
} catch (error) {
  console.log("Could not list processes", error.message);
}
