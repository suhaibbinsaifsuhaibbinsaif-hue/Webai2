import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route: Chat Completion
  app.post("/api/chat", async (req, res) => {
    try {
      const {
        provider,
        model,
        apiKey,
        messages,
        systemPrompt,
        temperature,
        maxTokens,
        topP,
        presencePenalty,
        frequencyPenalty,
      } = req.body;

      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: "messages array is required" });
      }

      // 1. Gemini Implementation
      if (provider === "gemini") {
        const key = apiKey || process.env.GEMINI_API_KEY;
        if (!key) {
          return res.status(400).json({
            error: "Gemini API key is not configured. Please set it in the API Tokens page or ensure GEMINI_API_KEY is defined on the server.",
          });
        }

        const ai = new GoogleGenAI({
          apiKey: key,
          httpOptions: {
            headers: {
              "User-Agent": "aistudio-build",
            },
          },
        });

        // Map messages to Gemini contents structure
        const contents = messages.map((m) => ({
          role: m.role === "assistant" || m.role === "ai" ? "model" : "user",
          parts: [{ text: m.content }],
        }));

        const modelName = model || "gemini-3.5-flash";

        const config: any = {};
        if (systemPrompt) {
          config.systemInstruction = systemPrompt;
        }
        if (temperature !== undefined) config.temperature = temperature;
        if (maxTokens !== undefined) config.maxOutputTokens = maxTokens;
        if (topP !== undefined) config.topP = topP;

        const response = await ai.models.generateContent({
          model: modelName,
          contents,
          config,
        });

        return res.json({
          content: response.text || "",
          model: modelName,
          provider: "gemini",
        });
      }

      // 2. Real API Proxying for other providers if keys are set
      const providerKey = apiKey;
      if (providerKey) {
        if (provider === "openai") {
          const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${providerKey}`,
            },
            body: JSON.stringify({
              model: model || "gpt-4o",
              messages: [
                ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
                ...messages.map((m) => ({
                  role: m.role === "ai" || m.role === "assistant" ? "assistant" : "user",
                  content: m.content,
                })),
              ],
              temperature: temperature !== undefined ? temperature : 0.7,
              max_tokens: maxTokens !== undefined ? maxTokens : 2048,
              top_p: topP !== undefined ? topP : 1.0,
              presence_penalty: presencePenalty !== undefined ? presencePenalty : 0.0,
              frequency_penalty: frequencyPenalty !== undefined ? frequencyPenalty : 0.0,
            }),
          });
          const data = await response.json();
          if (data.error) {
            return res.status(400).json({ error: data.error.message || "OpenAI API Error" });
          }
          return res.json({
            content: data.choices?.[0]?.message?.content || "",
            model: model || "gpt-4o",
            provider: "openai",
          });
        }

        if (provider === "anthropic") {
          const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": providerKey,
              "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
              model: model || "claude-3-5-sonnet-latest",
              messages: messages.map((m) => ({
                role: m.role === "ai" || m.role === "assistant" ? "assistant" : "user",
                content: m.content,
              })),
              system: systemPrompt || undefined,
              max_tokens: maxTokens !== undefined ? maxTokens : 2048,
              temperature: temperature !== undefined ? temperature : 0.7,
              top_p: topP !== undefined ? topP : 1.0,
            }),
          });
          const data = await response.json();
          if (data.error) {
            return res.status(400).json({ error: data.error.message || "Anthropic API Error" });
          }
          return res.json({
            content: data.content?.[0]?.text || "",
            model: model || "claude-3-5-sonnet-latest",
            provider: "anthropic",
          });
        }

        // Groq, Mistral, DeepSeek, OpenRouter
        let baseUrl = "";
        let defaultModel = "";
        if (provider === "groq") {
          baseUrl = "https://api.groq.com/openai/v1/chat/completions";
          defaultModel = "llama3-8b-8192";
        } else if (provider === "mistral") {
          baseUrl = "https://api.mistral.ai/v1/chat/completions";
          defaultModel = "mistral-large-latest";
        } else if (provider === "deepseek") {
          baseUrl = "https://api.deepseek.com/v1/chat/completions";
          defaultModel = "deepseek-chat";
        } else if (provider === "openrouter") {
          baseUrl = "https://openrouter.ai/api/v1/chat/completions";
          defaultModel = "meta-llama/llama-3-8b-instruct:free";
        }

        if (baseUrl) {
          const response = await fetch(baseUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${providerKey}`,
            },
            body: JSON.stringify({
              model: model || defaultModel,
              messages: [
                ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
                ...messages.map((m) => ({
                  role: m.role === "ai" || m.role === "assistant" ? "assistant" : "user",
                  content: m.content,
                })),
              ],
              temperature: temperature !== undefined ? temperature : 0.7,
              max_tokens: maxTokens !== undefined ? maxTokens : 2048,
            }),
          });
          const data = await response.json();
          if (data.error) {
            return res.status(400).json({
              error: typeof data.error === "string" ? data.error : data.error.message || `${provider} API Error`,
            });
          }
          return res.json({
            content: data.choices?.[0]?.message?.content || "",
            model: model || defaultModel,
            provider,
          });
        }
      }

      // 3. Fallback: Simulation Mode using server-side Gemini
      const geminiServerKey = process.env.GEMINI_API_KEY;
      if (geminiServerKey) {
        const ai = new GoogleGenAI({
          apiKey: geminiServerKey,
          httpOptions: {
            headers: {
              "User-Agent": "aistudio-build",
            },
          },
        });

        const contents = [
          {
            role: "user",
            parts: [
              {
                text: `You are simulating a response from provider "${provider.toUpperCase()}" with model "${model || "Default"}".
If there is a system instruction, here it is: "${systemPrompt || "None"}".

Please respond to the user's latest query as if you were that model.
Keep in character and preserve the tone of the simulated model.
Prepend your response with a brief styled tag indicating simulation. For example:
"🤖 *[Simulated ${provider.toUpperCase()} (${model || "Default"})]*

<your actual response here>"

Here is the conversation history:
${messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n")}
`,
              },
            ],
          },
        ];

        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents,
        });

        return res.json({
          content: response.text || "",
          model: model || "simulated",
          provider,
          simulated: true,
        });
      }

      return res.status(400).json({
        error: `Please set the API key for ${provider.toUpperCase()} in the dashboard, or configure GEMINI_API_KEY on the server.`,
      });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message || "Internal server error" });
    }
  });

  // Serve static assets in production or use Vite middleware in dev
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
