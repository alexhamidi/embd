type Message = {
    role: "user" | "assistant" | "system";
    content: string;
  };
  
  type CompletionChoice = {
    message: Message;
    finish_reason: string;
    index: number;
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
  
  type APIError = {
    message: string;
    type: string;
    param: string;
    code: string;
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
  
  export const infer = async (
    system: string,
    body: string,
    responseType: "text/plain" | "application/json" = "text/plain",
    model: string = "meta-llama/llama-4-maverick",
    use_openai: boolean = false,
  ): Promise<string> => {
    const startTime = Date.now();
    if (use_openai) {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error("🤗 openai_api_key environment variable is not set");
      }
    } else {
      if (!process.env.OR_API_KEY) {
        throw new Error("🤗 or_api_key environment variable is not set");
      }
    }
  
    // Construct messages array
    const messages: Message[] = [
      { role: "system", content: system },
      { role: "user", content: body },
    ];

  
    const response = await fetch(BASE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${use_openai ? process.env.OPENAI_API_KEY : process.env.OR_API_KEY}`,
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