const isCompletionResponse = (data) => {
    return (typeof data === "object" &&
        data !== null &&
        "choices" in data &&
        Array.isArray(data.choices) &&
        "id" in data &&
        "created" in data &&
        "model" in data &&
        "usage" in data);
};
const BASE_URL = "https://openrouter.ai/api/v1/chat/completions";
export default async (system, body, responseType = "text/plain", model = "meta-llama/llama-4-maverick") => {
    const startTime = Date.now();
    if (!process.env.OR_API_KEY) {
        throw new Error("🤗 or_api_key environment variable is not set");
    }
    // Construct messages array
    const messages = [
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
        const errorData = (await response.json());
        console.log(errorData);
        throw new Error(`🤗 openrouter api error: ${errorData}`);
    }
    const data = await response.json();
    const endTime = Date.now();
    console.log(`🥽 Cerebras inference time: ${endTime - startTime}ms`);
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
        }
        catch (e) {
            if (e instanceof Error) {
                throw new Error(`🤗 invalid json response from api: ${e.message}`);
            }
            throw new Error("🤗 invalid json response from api");
        }
    }
    return content;
};
