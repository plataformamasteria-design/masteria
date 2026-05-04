async function main() {
  const res = await fetch('https://backboard.railway.app/graphql/v2', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer 22f545ee-63b1-448c-9dfe-51c6aa05a91e',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query: 'query { project(id: "c616be47-8eba-424b-9d79-6dbe01e269db") { services { edges { node { id name } } } } }'
    })
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}
main();
