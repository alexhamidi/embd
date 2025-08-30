// server.ts
import { Hono } from 'hono'
import { infer } from './ai'
import fs from 'fs'

const app = new Hono()
const cache = new Map<string, string>()

// --- Runtime theme CSS (no Tailwind compile needed) ---
const themeCss = `
:root {
/* Core surfaces */
--background: #191919;
--foreground: #e9e9e7;
--card: #202020;
--card-foreground: #e9e9e7;
--popover: #202020;
--popover-foreground: #e9e9e7;

/* Borders / inputs */
--border: rgba(255, 255, 255, 0.08);
--input: rgba(255, 255, 255, 0.08);
--ring: #e9e9e7;

/* Palette */
--primary: #e9e9e7;
--primary-foreground: #191919;
--secondary: #232323;
--secondary-foreground: #e9e9e7;
--muted: #232323;
--muted-foreground: #b3b3ae;
--accent: #e9e9e7;
--accent-foreground: #191919;

/* Status */
--destructive: #ff5c5c;
--destructive-foreground: #191919;

/* Sidebar */
--sidebar: #202020;
--sidebar-foreground: #e9e9e7;
--sidebar-primary: #e9e9e7;
--sidebar-primary-foreground: #191919;
--sidebar-accent: #e9e9e7;
--sidebar-accent-foreground: #191919;
--sidebar-border: rgba(255, 255, 255, 0.08);
--sidebar-ring: #e9e9e7;

/* Charts (monochrome only) */
--chart-1: #e9e9e7;
--chart-2: #b3b3ae;
--chart-3: #7d7c78;
--chart-4: #434343;
--chart-5: #2a2a2a;

/* Shadows */
--shadow-color: 0 0% 0%;
--shadow-opacity: 0.25;
--shadow-blur: 8px;
--shadow-offset-x: 0px;
--shadow-offset-y: 2px;

--shadow-xs:  0 1px 2px 0 hsl(var(--shadow-color) / 0.2);
--shadow-sm:  0 1px 3px 0 hsl(var(--shadow-color) / 0.25);
--shadow-md:  0 2px 4px 0 hsl(var(--shadow-color) / 0.25);
--shadow-lg:  0 4px 6px -1px hsl(var(--shadow-color) / 0.25);
--shadow-xl:  0 8px 10px -2px hsl(var(--shadow-color) / 0.3);
}


.bg-background { background-color: var(--background); }
.bg-card { background-color: var(--card); }
.bg-popover { background-color: var(--popover); }
.text-foreground { color: var(--foreground); }
.text-muted-foreground { color: var(--muted-foreground); }
.text-primary { color: var(--primary); }
.text-secondary { color: var(--secondary-foreground); }
.border-border { border-color: var(--border); }
.outline-ring\/50 { outline-color: color-mix(in oklab, var(--ring) 50%, transparent); }
.shadow-xs { box-shadow: var(--shadow-xs); }
.shadow-sm { box-shadow: var(--shadow-sm); }
.shadow-md { box-shadow: var(--shadow-md); }
.shadow-lg { box-shadow: var(--shadow-lg); }
.shadow-xl { box-shadow: var(--shadow-xl); }

`;

app.get('/theme.css', (c) => c.text(themeCss, 200, { 'Content-Type': 'text/css' }))

function injectHead(html: string) {
  const headBits = [
    `<script src="https://cdn.tailwindcss.com"></script>`,
    `<link rel="stylesheet" href="/theme.css">`,
  ].join('')
  return html.includes('</head>')
    ? html.replace('</head>', headBits + '</head>')
    : headBits + html
}

app.get('/favicon.ico', (c) => {
  return c.text('')
})

app.get('/*', async (c) => {
  try {
    const fullPath = c.req.path
    const queryString = c.req.url.split('?')[1] || ''
    const fullUrl = queryString ? `${fullPath}?${queryString}` : fullPath

    if (cache.has(fullUrl)) {
      return c.html(cache.get(fullUrl)!)
    }

    // Nudge the LLM to focus on semantic content; we will inject CSS ourselves
    const systemPrompt = `You are a web developer. Based on URL ${fullUrl}, generate a valid HTML page.
Only return raw HTML (no markdown). Use Tailwind utilities for layout/spacing (container, grid, p-*, flex, rounded, shadow).
For colors and surfaces, ALWAYS use these token classes (not Tailwind color names):
- bg-background, text-foreground, border-border, outline-ring/50
- bg-card, text-muted-foreground
- bg-primary, text-primary-foreground
- bg-secondary, text-secondary-foreground
- bg-accent, text-accent-foreground
Do NOT include <script src="https://cdn.tailwindcss.com"> or <link rel="stylesheet">; the server injects them. Prefer semantic HTML. 

Use JavaScript to make the page interactive.

Exclude page titles/headers, footers, captions, etc., keep it very simple with only the user's desired functionality present. 

Do not include backend requests to non-existent routes. Implemnet all the code natively in the file. Do not include any placeholder logic - provide full implementations only 

Do not output \`\`\`html or \`\`\`html\n`

    const userPrompt = `Generate a modern, sleek page for: ${fullUrl}`
    let html = ''
    try {

      html = await infer(systemPrompt, userPrompt, 'text/plain', 'openai/gpt-5')
    } catch (error) {
      console.error('Error generating webpage:', error)
      return c.json({ error: 'Failed to generate webpage', details: error instanceof Error ? error.message : 'Unknown error' }, 500)
    }


    const finalHtml = injectHead(html)
    cache.set(fullUrl, finalHtml)

    fs.writeFileSync('output.html', finalHtml)

    return c.html(finalHtml)
  } catch (error) {
    console.error('Error generating webpage:', error)
    return c.json({ error: 'Failed to generate webpage', details: error instanceof Error ? error.message : 'Unknown error' }, 500)
  }
})

import { serve } from 'bun'

serve({
  fetch: app.fetch,
  port: 3000,
  idleTimeout: 255,
})


export default app