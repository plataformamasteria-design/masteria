const http = require('http');

http.get('http://localhost:3000/equipes', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const errorMatch = data.match(/<h2 class="nextjs-toast-errors-title">([^<]+)<\/h2>/) || data.match(/data-nextjs-error="true">([^<]+)</);
    if (errorMatch) {
      console.log('Error Title:', errorMatch[1]);
    } else {
      console.log('No specific error title found.');
    }
    const stackMatch = data.match(/<pre>([\s\S]*?)<\/pre>/);
    if (stackMatch) {
      console.log('Stack:', stackMatch[1].replace(/<[^>]+>/g, '').substring(0, 1000));
    }
    
    // Also try checking if there is any mention of "Module not found"
    const moduleNotFound = data.match(/Module not found:([^<]+)/);
    if (moduleNotFound) {
        console.log('Module Not Found:', moduleNotFound[1]);
    }
  });
});
