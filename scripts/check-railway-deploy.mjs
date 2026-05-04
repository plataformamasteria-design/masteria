const token = "9e8aefa5-5cb8-4a92-8edc-36179b5b8524";
fetch('https://backboard.railway.app/graphql/v2', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    query: `
      query {
        deployments(input: {
          projectId: "c616be47-8eba-424b-9d79-6dbe01e269db",
          serviceId: "7c8cd7bd-09ff-4383-b665-397c849260f1"
        }) {
          edges {
            node {
              id
              status
              createdAt
            }
          }
        }
      }
    `
  })
}).then(res => res.json()).then(data => {
   console.log(JSON.stringify(data, null, 2));
}).catch(console.error);
