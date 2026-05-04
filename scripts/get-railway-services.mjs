const token = "9e8aefa5-5cb8-4a92-8edc-36179b5b8524";

async function run() {
  // Try projects query (plural)
  const res = await fetch('https://backboard.railway.app/graphql/v2', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query: `query { projects(first: 10) { edges { node { id name } } } }`
    })
  });
  const data = await res.json();
  
  if (data.errors) {
    console.log("Projects query failed:", JSON.stringify(data.errors));
    
    // Try with the known project ID
    const res2 = await fetch('https://backboard.railway.app/graphql/v2', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: `query { service(id: "7c8cd7bd-09ff-4383-b665-397c849260f1") { id name } }`
      })
    });
    const svc = await res2.json();
    console.log("\nService by ID:", JSON.stringify(svc, null, 2));
  } else {
    console.log("Projects:", JSON.stringify(data, null, 2));
    
    // For each project, get services
    for (const edge of (data.data?.projects?.edges || [])) {
      const pid = edge.node.id;
      const res2 = await fetch('https://backboard.railway.app/graphql/v2', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: `query($id: String!) { project(id: $id) { services { edges { node { id name } } } environments { edges { node { id name } } } } }`,
          variables: { id: pid }
        })
      });
      const proj = await res2.json();
      console.log(`\nProject ${edge.node.name} services:`, JSON.stringify(proj, null, 2));
    }
  }
}

run().catch(console.error);
