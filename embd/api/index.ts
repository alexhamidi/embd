import { Hono } from 'hono'
import { handle } from 'hono/vercel'
import { createClient } from 'redis';

const client = createClient({
    username: 'default',
    password: process.env.REDIS_PASSWORD,
    socket: {
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT || '6379')
    }
});

let isRedisConnected = false;

async function initRedis() {
    if (!isRedisConnected && process.env.REDIS_HOST && process.env.REDIS_PASSWORD) {
        try {
            await client.connect();
            isRedisConnected = true;
            console.log('✅ Redis connected successfully');
        } catch (error) {
            console.warn('⚠️ Redis connection failed:', error);
            isRedisConnected = false;
        }
    }
}

async function getFromCache(key: string): Promise<string | null> {
    if (!isRedisConnected) return null;
    try {
        return await client.get(key);
    } catch (error) {
        console.warn('⚠️ Redis get failed:', error);
        return null;
    }
}

async function setToCache(key: string, value: string, ttlSeconds = 3600): Promise<void> {
    if (!isRedisConnected) return;
    try {
        await client.setEx(key, ttlSeconds, value);
    } catch (error) {
        console.warn('⚠️ Redis set failed:', error);
    }
}

initRedis();



const app = new Hono()
type Message = {
    role: "user" | "assistant" | "system";
    content: string;
};

type CompletionChoice = {
    message: Message;
    finish_reason: string;
    index: number;
};

type APIError = {
    message: string;
    type: string;
    param: string;
    code: string;
};

type CompletionResponse = {
    id: string;
    choices: CompletionChoice[];
    created: number;
    model: string;
    usage: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    };
  };


const isCompletionResponse = (data: unknown): data is CompletionResponse => {
    return (
      typeof data === "object" &&
      data !== null &&
      "choices" in data &&
      Array.isArray((data as CompletionResponse).choices) &&
      "id" in data &&
      "created" in data &&
      "model" in data &&
      "usage" in data
    );
  };
  
  const BASE_URL = "https://openrouter.ai/api/v1/chat/completions";

async function ai(
    system: string,
    body: string,
    responseType: "text/plain" | "application/json" = "text/plain",
    model: string = "meta-llama/llama-4-maverick",
  ): Promise<string> {
    const startTime = Date.now();

    if (!process.env.OR_API_KEY) {
        throw new Error("🤗 or_api_key environment variable is not set");
      }
  
    // Construct messages array
    const messages: Message[] = [
      { role: "system", content: system },
      { role: "user", content: body },
    ];

    
    const response = await fetch(BASE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OR_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        provider: {
          // only: ["Cerebras", "Groq"],
          only: ["Groq"],
        },
        messages,
      }),
    });
  
    if (!response.ok) {
      const errorData = (await response.json()) as APIError;
      console.log(errorData);
      throw new Error(`🤗 openrouter api error: ${errorData}`);
    }
  
    const data = await response.json();
    const endTime = Date.now();
    console.log(`🥽 Groq inference time: ${endTime - startTime}ms`);
  
    if (!isCompletionResponse(data)) {
      throw new Error("🤗 invalid response format from open router api");
    }
  
    const content = data.choices[0]?.message?.content;
    if (!content) {
      throw new Error("🤗 no content in response from open router api");
    }
  
    // If JSON response is requested, validate the response
    if (responseType === "application/json") {
      try {
        const jsonResponse = JSON.parse(content);
        return JSON.stringify(jsonResponse);
      } catch (e: unknown) {
        if (e instanceof Error) {
          throw new Error(`🤗 invalid json response from api: ${e.message}`);
        }
        throw new Error("🤗 invalid json response from api");
      }
    }
  
    return content;
  };


  

  `
  
  `

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

    const cachedHtml = await getFromCache(fullUrl)
    if (cachedHtml) {
      console.log(`📦 Cache hit for: ${fullUrl}`)
      return c.html(cachedHtml)
    }

    console.log(`🔄 Cache miss for: ${fullUrl}, generating new content`)

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
      html = await ai(systemPrompt, userPrompt, 'text/plain', 'openai/gpt-5')
    } catch (error) {
      console.error('Error generating webpage:', error)
      return c.json({ error: 'Failed to generate webpage', details: error instanceof Error ? error.message : 'Unknown error' }, 500)
    }

    const finalHtml = injectHead(html)
    await setToCache(fullUrl, finalHtml, 3600)

    return c.html(finalHtml)
  } catch (error) {
    console.error('Error generating webpage:', error)
    return c.json({ error: 'Failed to generate webpage', details: error instanceof Error ? error.message : 'Unknown error' }, 500)
  }
})

export default handle(app)