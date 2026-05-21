const ctx = {
  variables: {
    "respondent.answers.Qual seu nome?": "Deivid Rodrigues",
    webhook_body: {
      respondent: {
        answers: {
          "Qual seu nome?": "Deivid Rodrigues"
        }
      }
    }
  }
};

async function interpolateTemplate(content: string, ctx: any): Promise<string> {
    if (!content) return '';
    return content.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
        const path = key.trim();
        if (ctx.variables[path] !== undefined) return ctx.variables[path];
        if (path.includes('.')) {
            const segments = path.split('.');
            const lastSegment = segments[segments.length - 1];
            if (ctx.variables[lastSegment] !== undefined) return ctx.variables[lastSegment];

            const bodyIdx = segments.findIndex((s: string) => s.trim().toLowerCase() === 'body');
            if (bodyIdx >= 0 && bodyIdx < segments.length - 1) {
                const bodyKey = segments.slice(bodyIdx + 1).join('.');
                if (ctx.variables[bodyKey] !== undefined) return String(ctx.variables[bodyKey]);
                
                const wb = ctx.variables.webhook_body;
                if (wb && typeof wb === 'object') {
                    const val = bodyKey.split('.').reduce((obj: any, k: string) => obj?.[k], wb);
                    if (val !== undefined) return String(val);
                }
            }
        }
        return '';
    });
}

async function run() {
  const res = await interpolateTemplate('{{body.respondent.answers.Qual seu nome?}}', ctx);
  console.log("Result:", res);
}
run();
