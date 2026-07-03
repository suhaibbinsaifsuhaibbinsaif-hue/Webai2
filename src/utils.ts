import { Provider } from "./types";

export const PROVIDERS: Provider[] = [
  { id: "gemini", name: "Gemini API Key", prefix: "AIza" },
  { id: "openai", name: "OpenAI API Key", prefix: "sk-" },
  { id: "anthropic", name: "Anthropic API Key", prefix: "sk-ant-" },
  { id: "groq", name: "Groq API Key", prefix: "gsk_" },
  { id: "openrouter", name: "OpenRouter API Key", prefix: "sk-or-v1-" },
  { id: "deepseek", name: "DeepSeek API Key", prefix: "sk-" },
  { id: "mistral", name: "Mistral API Key", prefix: "" },
  { id: "together", name: "Together AI Key", prefix: "" },
  { id: "replicate", name: "Replicate API Token", prefix: "r8_" },
  { id: "telegram", name: "Telegram Bot Token", prefix: "bot" },
  { id: "huggingface", name: "Hugging Face Token", prefix: "hf_" },
  { id: "github", name: "GitHub PAT", prefix: "ghp_" },
];

export function validateToken(providerId: string, value: string): boolean {
  if (!value) return false;
  const p = PROVIDERS.find((prov) => prov.id === providerId);
  if (p && p.prefix) {
    return value.startsWith(p.prefix);
  }
  return value.length > 10;
}

export function escapeHTML(str: string): string {
  if (!str) return "";
  return str.replace(/[&<>'"]/g, (tag) => {
    return (
      {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      }[tag] || tag
    );
  });
}

// Custom Markdown to Safe HTML parser for rendering in chat
export function parseMarkdown(text: string): string {
  if (!text) return "";
  let html = escapeHTML(text);

  // Code blocks (multi-line)
  html = html.replace(
    /```(\w+)?\n([\s\S]*?)```/g,
    (_, lang, code) =>
      `<div class="relative group my-3"><div class="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity"><button onclick="navigator.clipboard.writeText(\`${code.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`)" class="bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 px-2 py-1 rounded border border-slate-700">Copy</button></div><pre><code class="language-${lang || "text"}">${code}</code></pre></div>`
  );

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-xs">$1</code>');

  // Bold
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

  // Italic
  html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");

  // Blockquotes
  html = html.replace(
    /^&gt;\s(.*$)/gim,
    '<blockquote class="border-l-4 border-indigo-500 pl-3 my-2 text-slate-400 italic">$1</blockquote>'
  );

  // Unordered Lists
  html = html.replace(/^\s*-\s+(.*$)/gim, '<li class="ml-4 list-disc">$1</li>');

  // Bullet items wrapped in lists
  // Simple check: replace lists
  
  // Line breaks (convert single \n to <br> if not in a tag)
  html = html.replace(/\n/g, "<br>");

  return html;
}

export function estimateTokenCount(text: string): number {
  if (!text) return 0;
  // Estimate: 1 token ~= 4 characters
  return Math.max(1, Math.floor(text.length / 4));
}
