const token = "9e8aefa5-5cb8-4a92-8edc-36179b5b8524";

async function run() {
  const query = `
    query {
      projectToken {
        projectId
      }
    }
  `;

  const res = await fetch('https://backboard.railway.app/graphql/v2', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query })
  });
  
  const data = await res.json();
  console.log("Token Scope:", JSON.stringify(data, null, 2));
}

run().catch(console.error);
