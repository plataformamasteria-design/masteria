const token = "9e8aefa5-5cb8-4a92-8edc-36179b5b8524";

async function run() {
  const query = `
    query {
      projectToken {
        projectId
        serviceId
        environmentId
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

  if (data.data?.projectToken?.projectId) {
     const pid = data.data.projectToken.projectId;
     // Try to get service list from project again, maybe I missed a field or permission
     const res2 = await fetch('https://backboard.railway.app/graphql/v2', {
       method: 'POST',
       headers: {
         'Authorization': `Bearer ${token}`,
         'Content-Type': 'application/json'
       },
       body: JSON.stringify({
         query: `query($pid: String!) { project(id: $pid) { name services { edges { node { id name } } } } }`,
         variables: { pid }
       })
     });
     console.log("Project Info:", JSON.stringify(await res2.json(), null, 2));
  }
}

run().catch(console.error);
