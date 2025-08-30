import { Hono } from 'hono';
import cerebras from './cerebras.js';
const app = new Hono();
// Endpoint to generate HTML webpage from any route
app.get('/*', async (c) => {
    try {
        // Get the full path including query parameters
        const fullPath = c.req.path;
        const queryString = c.req.url.split('?')[1] || '';
        const fullUrl = queryString ? `${fullPath}?${queryString}` : fullPath;
        const systemPrompt = `You are a web developer. Based on the given url/request, generate a valid html webpage. The url/request is ${fullUrl}. Only return html, no markdown, no other text. Make sure to use css to make the website beautiful. Make sure the website is modern/sleek and uses plenty of css UI elements. be complete and do not leave out any information. do not output \`\`\`html`;
        const userPrompt = `Based on this url/request generate a valid html webpage: ${fullUrl}`;
        // Generate HTML using Cerebras LLM
        const htmlContent = await cerebras(systemPrompt, userPrompt, "text/plain", "meta-llama/llama-4-scout");
        // Return raw HTML
        return c.html(htmlContent);
    }
    catch (error) {
        console.error('Error generating webpage:', error);
        return c.json({
            error: 'Failed to generate webpage',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, 500);
    }
});
export default app;
