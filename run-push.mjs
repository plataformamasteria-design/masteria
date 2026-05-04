import { spawn } from 'child_process';

const pushProcess = spawn('npx', ['drizzle-kit', 'push', '--config=drizzle.config.ts'], {
  env: { ...process.env, DATABASE_URL: 'postgresql://neondb_owner:npg_3A4aphDSoLUZ@ep-broad-truth-afj172ni.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require' },
  shell: true,
});

pushProcess.stdout.on('data', (data) => {
  const output = data.toString();
  process.stdout.write(output);
  
  if (output.includes('Is') && output.includes('created or renamed from another column')) {
    console.log('\n[AUTO-ANSWER] Sending ENTER to select "create column"');
    pushProcess.stdin.write('\r\n');
  } else if (output.includes('Do you want to continue')) {
    console.log('\n[AUTO-ANSWER] Sending Y');
    pushProcess.stdin.write('y\r\n');
  } else if (output.includes('data loss')) {
    console.log('\n[AUTO-ANSWER] Sending Y');
    pushProcess.stdin.write('y\r\n');
  } else if (output.includes('❯')) {
    // any other generic prompt
    pushProcess.stdin.write('\r\n');
  }
});

pushProcess.stderr.on('data', (data) => {
  process.stderr.write(data.toString());
});

pushProcess.on('close', (code) => {
  console.log(`Push process exited with code ${code}`);
  process.exit(code);
});
