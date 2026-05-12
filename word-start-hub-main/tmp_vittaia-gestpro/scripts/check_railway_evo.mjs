import fs from "fs";

async function run() {
    const token = '020d4852-e895-4343-8588-0b19626a9b06';
    const projectId = '2c397b86-a4fc-47a5-8774-fceacfc93acd';

    const query = `
    query project($id: String!) {
      project(id: $id) {
        id
        name
        services {
          edges {
            node {
              id
              name
            }
          }
        }
        environments {
          edges {
            node {
              id
              name
            }
          }
        }
      }
    }
  `;

    // Fetch project details first
    try {
        console.log('Fetching project details...');
        let res = await fetch('https://backboard.railway.app/graphql/v2', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query, variables: { id: projectId } })
        });

        let data = await res.json();
        if (data.errors) {
            console.error("GraphQL errors:", JSON.stringify(data.errors, null, 2));
            return;
        }

        const project = data.data.project;
        if (!project) {
            console.error("Project not found!");
            return;
        }
        console.log(`Project: ${project.name}`);

        const services = project.services.edges.map(e => e.node);
        const envs = project.environments.edges.map(e => e.node);
        console.log("Services:", services);

        if (services.length > 0 && envs.length > 0) {
            const serviceId = services[0].id; // assuming primary service
            const envId = envs[0].id; // assuming primary env

            console.log(`\nFetching deployments for Service: ${services[0].name} in Env: ${envs[0].name}...`);

            // Fetch deployments
            const depsQuery = `
          query {
            deployments(input: { serviceId: "${serviceId}", environmentId: "${envId}" }) {
              edges {
                node {
                  id
                  status
                  createdAt
                  updatedAt
                  staticUrl
                }
              }
            }
          }
        `;

            res = await fetch('https://backboard.railway.app/graphql/v2', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ query: depsQuery })
            });

            const depsData = await res.json();
            const deployments = depsData.data.deployments.edges.map(e => e.node);

            console.log(`Found ${deployments.length} deployments.`);

            // Show top 3 recent deployments
            const recent = deployments.slice(0, 3);
            console.table(recent);

            // Fetch logs for the most recent deployment if status is CRASHED or FAILED
            for (const dep of recent) {
                console.log(`\n--- Fetching logs for Deployment ${dep.id} (Status: ${dep.status}) ---`);
                const logsQuery = `
              query {
                deploymentLogs(deploymentId: "${dep.id}", limit: 50) {
                  logs {
                    message
                    timestamp
                    severity
                  }
                }
              }
            `;

                const logRes = await fetch('https://backboard.railway.app/graphql/v2', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ query: logsQuery })
                });

                const logData = await logRes.json();
                if (logData.data && logData.data.deploymentLogs) {
                    const logs = logData.data.deploymentLogs.logs;
                    console.log(`Found ${logs.length} logs. Last 10 lines:`);
                    logs.slice(-10).forEach(l => console.log(`[${l.timestamp}] ${l.severity}: ${l.message}`));
                } else {
                    console.log("No logs accessible via this query or not found.");
                }
            }
        }
    } catch (err) {
        console.error("Fetch error:", err);
    }
}

run();
