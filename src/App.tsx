import React, { useState, useEffect, useRef } from "react";
import {
  Key,
  Settings,
  MessageSquare,
  FileText,
  Activity,
  Cpu,
  Copy,
  Eye,
  EyeOff,
  Trash2,
  Trash,
  Plus,
  Download,
  Upload,
  Search,
  Sun,
  Moon,
  Send,
  Wifi,
  WifiOff,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { AppState, ChatMessage, ChatSession, LogEntry, CustomToken, ModelConfig, SystemSettings } from "./types";
import { PROVIDERS, validateToken, parseMarkdown, estimateTokenCount } from "./utils";

// Default Initial State
const DEFAULT_STATE: AppState = {
  tokens: {},
  config: {
    provider: "gemini",
    model: "gemini-3.5-flash",
    baseUrl: "",
    temperature: 0.7,
    maxTokens: 2048,
    topP: 1.0,
    presencePenalty: 0.0,
    frequencyPenalty: 0.0,
    systemPrompt: "You are a highly helpful and concise AI assistant.",
    defaultPrompt: ""
  },
  settings: {
    autoSave: true,
    theme: "dark"
  },
  chat: [
    {
      id: 1719940000000,
      name: "Default Session",
      messages: [
        {
          role: "ai",
          content: "Hello! Welcome to the AI Playground. Set your API Key in the **API Tokens** page and start exploring models in the **AI Configuration** page! If no key is set, I can simulate responses using the server-side default model.",
          timestamp: new Date().toLocaleTimeString()
        }
      ]
    }
  ],
  activeChatId: 1719940000000,
  logs: [
    {
      time: new Date().toLocaleTimeString(),
      message: "System initialized and ready."
    }
  ]
};

export default function App() {
  // Main State
  const [state, setState] = useState<AppState>(DEFAULT_STATE);
  const [activeTab, setActiveTab] = useState<string>("tokens-section");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showAllTokens, setShowAllTokens] = useState<boolean>(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [customProviderName, setCustomProviderName] = useState<string>("");
  const [customProviderValue, setCustomProviderValue] = useState<string>("");
  const [chatInput, setChatInput] = useState<string>("");
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [visibleTokenIds, setVisibleTokenIds] = useState<Record<string, boolean>>({});
  const [isAdvancedOpen, setIsAdvancedOpen] = useState<boolean>(true);

  // UI Toast State
  const [toasts, setToasts] = useState<Array<{ id: number; message: string; type: "success" | "error" | "info" }>>([]);

  // File import ref
  const importFileRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // ----------------------------------------------------
  // Initial Boot & Loading
  // ----------------------------------------------------
  useEffect(() => {
    // Check Network
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Load LocalStorage
    try {
      const saved = localStorage.getItem("aiDashboardData");
      if (saved) {
        const parsed = JSON.parse(saved);
        // Fallback checks
        if (!parsed.tokens) parsed.tokens = {};
        if (!parsed.config) parsed.config = { ...DEFAULT_STATE.config };
        if (!parsed.settings) parsed.settings = { ...DEFAULT_STATE.settings };
        if (!parsed.chat || parsed.chat.length === 0) parsed.chat = [...DEFAULT_STATE.chat];
        if (!parsed.logs) parsed.logs = [];
        if (!parsed.activeChatId) parsed.activeChatId = parsed.chat[0]?.id || DEFAULT_STATE.activeChatId;

        setState(parsed);
        applyTheme(parsed.settings.theme || "dark");
        logActivityAction(parsed, "Dashboard loaded from LocalStorage.");
      } else {
        localStorage.setItem("aiDashboardData", JSON.stringify(DEFAULT_STATE));
        applyTheme("dark");
      }
    } catch (e) {
      console.error("Failed to load local storage", e);
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Scroll chat messages to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.activeChatId, state.chat, isAiLoading]);

  // ----------------------------------------------------
  // Toast Notification Helpers
  // ----------------------------------------------------
  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  };

  // ----------------------------------------------------
  // Helper functions
  // ----------------------------------------------------
  const updateStateAndSave = (updater: (prev: AppState) => AppState) => {
    setState((prev) => {
      const next = updater(prev);
      if (next.settings.autoSave) {
        try {
          localStorage.setItem("aiDashboardData", JSON.stringify(next));
        } catch (e) {
          console.error("Autosave failed", e);
        }
      }
      return next;
    });
  };

  const logActivity = (message: string) => {
    updateStateAndSave((prev) => {
      const newLogs: LogEntry[] = [
        { time: new Date().toLocaleTimeString(), message },
        ...prev.logs.slice(0, 49) // Max 50 logs
      ];
      return { ...prev, logs: newLogs };
    });
  };

  const logActivityAction = (currentState: AppState, message: string) => {
    // Simple helper when updateStateAndSave would conflict with synchronous updates
    currentState.logs = [
      { time: new Date().toLocaleTimeString(), message },
      ...currentState.logs.slice(0, 49)
    ];
  };

  const applyTheme = (theme: "dark" | "light") => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  };

  const toggleTheme = () => {
    const nextTheme = state.settings.theme === "dark" ? "light" : "dark";
    applyTheme(nextTheme);
    updateStateAndSave((prev) => ({
      ...prev,
      settings: { ...prev.settings, theme: nextTheme }
    }));
    logActivity(`Theme changed to ${nextTheme}.`);
    showToast(`Switched to ${nextTheme} theme`, "info");
  };

  // ----------------------------------------------------
  // API Tokens actions
  // ----------------------------------------------------
  const handleTokenChange = (providerId: string, val: string) => {
    updateStateAndSave((prev) => {
      const nextTokens = { ...prev.tokens, [providerId]: val };
      return { ...prev, tokens: nextTokens };
    });
  };

  const handleCustomTokenChange = (field: "name" | "value", val: string) => {
    if (field === "name") setCustomProviderName(val);
    else setCustomProviderValue(val);

    updateStateAndSave((prev) => {
      const existingCustom = prev.tokens.custom || { name: "", value: "" };
      const nextCustom = {
        ...existingCustom,
        [field]: val
      };
      return {
        ...prev,
        tokens: {
          ...prev.tokens,
          custom: nextCustom
        }
      };
    });
  };

  const toggleTokenVisibility = (id: string) => {
    setVisibleTokenIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const copyTokenToClipboard = async (id: string) => {
    const tokenVal = state.tokens[id];
    if (!tokenVal) {
      showToast("Token is empty!", "error");
      return;
    }
    try {
      await navigator.clipboard.writeText(tokenVal);
      showToast("Token copied to clipboard!", "success");
      logActivity(`Copied ${id} API key.`);
    } catch (e) {
      showToast("Failed to copy token.", "error");
    }
  };

  const clearToken = (id: string) => {
    handleTokenChange(id, "");
    showToast(`Cleared token for ${id}`, "info");
    logActivity(`Cleared token for ${id}.`);
  };

  const copyAllTokens = async () => {
    let outputText = "--- API Nexus Export ---\n";
    PROVIDERS.forEach((p) => {
      const tokenVal = state.tokens[p.id];
      if (tokenVal) {
        outputText += `${p.name}: ${tokenVal}\n`;
      }
    });

    const customToken = state.tokens.custom;
    if (customToken && customToken.value) {
      outputText += `${customToken.name || "Custom Provider"}: ${customToken.value}\n`;
    }

    if (outputText === "--- API Nexus Export ---\n") {
      showToast("No tokens configured to copy!", "error");
      return;
    }

    try {
      await navigator.clipboard.writeText(outputText);
      showToast("All active tokens copied to clipboard!", "success");
      logActivity("Copied all configured tokens to clipboard.");
    } catch (e) {
      showToast("Failed to copy all tokens.", "error");
    }
  };

  const revealAllTokens = (reveal: boolean) => {
    const nextVis: Record<string, boolean> = {};
    PROVIDERS.forEach((p) => {
      nextVis[p.id] = reveal;
    });
    nextVis["custom"] = reveal;
    setVisibleTokenIds(nextVis);
    showToast(reveal ? "All tokens revealed" : "All tokens hidden", "info");
  };

  // ----------------------------------------------------
  // Model Config Actions
  // ----------------------------------------------------
  const handleConfigChange = (field: keyof ModelConfig, value: any) => {
    updateStateAndSave((prev) => ({
      ...prev,
      config: { ...prev.config, [field]: value }
    }));
  };

  const loadPromptTemplate = (type: string) => {
    let selectedPrompt = "";
    if (type === "code") {
      selectedPrompt = "Write a clean, optimized, and fully-commented TypeScript function to do the following:\n\n[Explain task]";
    } else if (type === "translate") {
      selectedPrompt = "Translate the following content into [Target Language] with high structural clarity and proper technical vocabulary:\n\n";
    } else if (type === "write") {
      selectedPrompt = "Compose a creative and persuasive email announcement about [Subject], maintaining a professional yet enthusiastic tone.";
    }

    if (selectedPrompt) {
      handleConfigChange("defaultPrompt", selectedPrompt);
      showToast("Template loaded into default prompt", "success");
      logActivity(`Loaded template: ${type}`);
    }
  };

  // ----------------------------------------------------
  // Chat Actions
  // ----------------------------------------------------
  const createNewChatSession = () => {
    const newSessionId = Date.now();
    updateStateAndSave((prev) => {
      const newSession: ChatSession = {
        id: newSessionId,
        name: `Session ${prev.chat.length + 1}`,
        messages: []
      };
      return {
        ...prev,
        chat: [...prev.chat, newSession],
        activeChatId: newSessionId
      };
    });
    logActivity("Created new chat playground session.");
    showToast("New chat session created", "success");
  };

  const deleteChatSession = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    updateStateAndSave((prev) => {
      const filteredChat = prev.chat.filter((c) => c.id !== id);
      const nextChat = filteredChat.length === 0 ? [...DEFAULT_STATE.chat] : filteredChat;
      const nextActiveId = prev.activeChatId === id ? nextChat[0].id : prev.activeChatId;
      return {
        ...prev,
        chat: nextChat,
        activeChatId: nextActiveId
      };
    });
    logActivity("Deleted a chat playground session.");
    showToast("Chat session deleted", "info");
  };

  const clearActiveChatMessages = () => {
    if (confirm("Are you sure you want to clear this chat's messages?")) {
      updateStateAndSave((prev) => {
        const nextChat = prev.chat.map((c) => {
          if (c.id === prev.activeChatId) {
            return { ...c, messages: [] };
          }
          return c;
        });
        return { ...prev, chat: nextChat };
      });
      logActivity("Cleared active chat messages.");
      showToast("Active chat messages cleared", "info");
    }
  };

  const handleSendMessage = async () => {
    const inputMsg = chatInput.trim();
    if (!inputMsg) return;

    // Get Active Session
    const activeSession = state.chat.find((c) => c.id === state.activeChatId);
    if (!activeSession) return;

    const userMessage: ChatMessage = {
      role: "user",
      content: inputMsg,
      timestamp: new Date().toLocaleTimeString()
    };

    // Optimistically update UI with user message
    const updatedMessages = [...activeSession.messages, userMessage];
    updateStateAndSave((prev) => {
      const nextChat = prev.chat.map((c) => {
        if (c.id === prev.activeChatId) {
          return {
            ...c,
            messages: updatedMessages,
            // Automatically rename session from the first prompt
            name: c.messages.length === 0 && inputMsg.length > 25 ? `${inputMsg.substring(0, 25)}...` : c.name
          };
        }
        return c;
      });
      return { ...prev, chat: nextChat };
    });

    setChatInput("");
    setIsAiLoading(true);

    try {
      // API call body preparation
      const providerId = state.config.provider;
      const key = providerId === "custom" ? state.tokens.custom?.value : state.tokens[providerId];

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: providerId,
          model: state.config.model,
          apiKey: key,
          messages: updatedMessages,
          systemPrompt: state.config.systemPrompt,
          temperature: state.config.temperature,
          maxTokens: state.config.maxTokens,
          topP: state.config.topP,
          presencePenalty: state.config.presencePenalty,
          frequencyPenalty: state.config.frequencyPenalty
        })
      });

      const data = await response.json();

      if (response.ok && data.content) {
        const aiMessage: ChatMessage = {
          role: "ai",
          content: data.content,
          timestamp: new Date().toLocaleTimeString()
        };

        updateStateAndSave((prev) => {
          const nextChat = prev.chat.map((c) => {
            if (c.id === prev.activeChatId) {
              return { ...c, messages: [...c.messages, aiMessage] };
            }
            return c;
          });
          return { ...prev, chat: nextChat };
        });

        logActivity(`AI Response received for active provider (${providerId}).`);
      } else {
        const errorMessage = data.error || "Failed to generate AI response. Unknown error.";
        showToast(errorMessage, "error");
        logActivity(`AI Error: ${errorMessage}`);
      }
    } catch (err: any) {
      const errTxt = err?.message || "Internal network failure proxying request.";
      showToast(errTxt, "error");
      logActivity(`Fetch Error: ${errTxt}`);
    } finally {
      setIsAiLoading(false);
    }
  };

  const exportChatSession = (format: "txt" | "json") => {
    const activeSession = state.chat.find((c) => c.id === state.activeChatId);
    if (!activeSession || activeSession.messages.length === 0) {
      showToast("No conversation to export!", "error");
      return;
    }

    let payload = "";
    let mimeType = "text/plain";
    let ext = "txt";

    if (format === "json") {
      payload = JSON.stringify(activeSession.messages, null, 2);
      mimeType = "application/json";
      ext = "json";
    } else {
      payload = `API Playground Chat Session: ${activeSession.name}\n`;
      payload += `==============================================\n\n`;
      activeSession.messages.forEach((m) => {
        payload += `[${m.timestamp}] ${m.role.toUpperCase()}:\n${m.content}\n\n`;
      });
    }

    const blob = new Blob([payload], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `chat-export-${activeSession.id}.${ext}`;
    link.click();
    URL.revokeObjectURL(url);
    logActivity(`Exported active chat as ${format.toUpperCase()}.`);
    showToast(`Chat exported as ${format.toUpperCase()}`, "success");
  };

  // ----------------------------------------------------
  // Import / Export Actions
  // ----------------------------------------------------
  const handleExportBackup = () => {
    const payload = JSON.stringify(state, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `nexus-dashboard-backup-${new Date().toISOString().split("T")[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    logActivity("Exported backup configuration JSON file.");
    showToast("Backup exported successfully!", "success");
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsedState = JSON.parse(event.target?.result as string);
        if (parsedState && typeof parsedState === "object" && parsedState.tokens && parsedState.config) {
          // Keep current date in log
          parsedState.logs = [
            { time: new Date().toLocaleTimeString(), message: "Configuration imported successfully." },
            ...(parsedState.logs || []).slice(0, 48)
          ];
          setState(parsedState);
          // Save to local storage
          localStorage.setItem("aiDashboardData", JSON.stringify(parsedState));
          applyTheme(parsedState.settings?.theme || "dark");
          showToast("Dashboard successfully restored!", "success");
          logActivity("Imported configuration from JSON file backup.");
        } else {
          showToast("Invalid JSON schema structure.", "error");
        }
      } catch (err) {
        showToast("Failed to parse JSON backup file.", "error");
      }
    };
    reader.readAsText(file);
  };

  const clearAllData = () => {
    if (confirm("WARNING: This will completely delete all API Keys, custom configurations, templates, and chat sessions. This action is irreversible. Proceed?")) {
      localStorage.removeItem("aiDashboardData");
      setState(DEFAULT_STATE);
      applyTheme("dark");
      showToast("All dashboard database state reset to defaults", "info");
      logActivity("Completely reset storage database to default settings.");
    }
  };

  const triggerManualSave = () => {
    try {
      localStorage.setItem("aiDashboardData", JSON.stringify(state));
      showToast("Data saved successfully!", "success");
      logActivity("Manual backup save to LocalStorage triggered.");
    } catch (e) {
      showToast("Failed to save data locally.", "error");
    }
  };

  // Helper values
  const totalStorageSize = () => {
    try {
      const dataString = JSON.stringify(state);
      return `${(dataString.length * 2 / 1024).toFixed(2)} KB`;
    } catch (e) {
      return "0.00 KB";
    }
  };

  // Active chat calculation
  const currentChatSession = state.chat.find((c) => c.id === state.activeChatId) || state.chat[0];
  const totalChatTokensEstimated = currentChatSession
    ? currentChatSession.messages.reduce((acc, m) => acc + estimateTokenCount(m.content), 0)
    : 0;

  // Render tokens search query
  const filteredProviders = PROVIDERS.filter((p) => {
    const lowerQuery = searchQuery.toLowerCase();
    return p.name.toLowerCase().includes(lowerQuery) || p.id.toLowerCase().includes(lowerQuery);
  });

  return (
    <div className="flex h-screen overflow-hidden font-sans text-slate-100 transition-colors duration-300 antialiased dark:bg-slate-950 bg-slate-50 dark:text-slate-100 text-slate-900">
      
      {/* Toast Notification Mount */}
      <div id="toast-container" className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2.5 max-w-sm pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-xl text-white font-medium pointer-events-auto transform animate-slideIn transition-all border ${
              toast.type === "success"
                ? "bg-emerald-600 border-emerald-500"
                : toast.type === "error"
                ? "bg-rose-600 border-rose-500"
                : "bg-indigo-600 border-indigo-500"
            }`}
          >
            {toast.type === "success" ? <CheckCircle size={18} /> : toast.type === "error" ? <XCircle size={18} /> : <Cpu size={18} />}
            <span className="text-sm">{toast.message}</span>
          </div>
        ))}
      </div>

      {/* Modern Mesh Gradient BG Backdrop */}
      <div className="fixed inset-0 pointer-events-none z-[-1] opacity-45 dark:opacity-30">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/20 blur-[120px] dark:bg-indigo-600/10"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-500/20 blur-[120px] dark:bg-purple-600/10"></div>
      </div>

      {/* Responsive Sidebar (AI Nexus Navigation Panel) */}
      <aside
        id="sidebar"
        className={`fixed inset-y-0 left-0 z-50 flex flex-col w-64 p-5 transition-transform duration-300 border-r dark:bg-slate-900/85 bg-white/90 backdrop-blur-xl border-slate-200 dark:border-slate-800 lg:static lg:translate-x-0 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Sidebar Logo */}
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 text-white bg-indigo-600 rounded-lg shadow-lg dark:bg-indigo-500 dark:shadow-indigo-500/20">
            <Cpu size={20} />
          </div>
          <span className="text-lg font-bold tracking-tight dark:text-white text-slate-800">AI Nexus</span>
        </div>

        {/* Sidebar Nav Items */}
        <nav className="flex-1 space-y-1.5 overflow-y-auto">
          <button
            onClick={() => {
              setActiveTab("tokens-section");
              setIsSidebarOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
              activeTab === "tokens-section"
                ? "bg-indigo-600 text-white dark:bg-indigo-500 dark:shadow-md dark:shadow-indigo-500/10"
                : "dark:text-slate-400 text-slate-600 dark:hover:bg-slate-800 hover:bg-slate-100 dark:hover:text-slate-200"
            }`}
          >
            <Key size={18} />
            <span>API Tokens</span>
          </button>

          <button
            onClick={() => {
              setActiveTab("config-section");
              setIsSidebarOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
              activeTab === "config-section"
                ? "bg-indigo-600 text-white dark:bg-indigo-500 dark:shadow-md dark:shadow-indigo-500/10"
                : "dark:text-slate-400 text-slate-600 dark:hover:bg-slate-800 hover:bg-slate-100 dark:hover:text-slate-200"
            }`}
          >
            <Settings size={18} />
            <span>AI Configuration</span>
          </button>

          <button
            onClick={() => {
              setActiveTab("chat-section");
              setIsSidebarOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
              activeTab === "chat-section"
                ? "bg-indigo-600 text-white dark:bg-indigo-500 dark:shadow-md dark:shadow-indigo-500/10"
                : "dark:text-slate-400 text-slate-600 dark:hover:bg-slate-800 hover:bg-slate-100 dark:hover:text-slate-200"
            }`}
          >
            <MessageSquare size={18} />
            <span>Playground Chat</span>
          </button>

          <button
            onClick={() => {
              setActiveTab("settings-section");
              setIsSidebarOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
              activeTab === "settings-section"
                ? "bg-indigo-600 text-white dark:bg-indigo-500 dark:shadow-md dark:shadow-indigo-500/10"
                : "dark:text-slate-400 text-slate-600 dark:hover:bg-slate-800 hover:bg-slate-100 dark:hover:text-slate-200"
            }`}
          >
            <FileText size={18} />
            <span>Import & Export</span>
          </button>

          <button
            onClick={() => {
              setActiveTab("activity-section");
              setIsSidebarOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
              activeTab === "activity-section"
                ? "bg-indigo-600 text-white dark:bg-indigo-500 dark:shadow-md dark:shadow-indigo-500/10"
                : "dark:text-slate-400 text-slate-600 dark:hover:bg-slate-800 hover:bg-slate-100 dark:hover:text-slate-200"
            }`}
          >
            <Activity size={18} />
            <span>Activity Log</span>
          </button>
        </nav>

        {/* Sidebar Status Footer */}
        <div className="pt-4 border-t dark:border-slate-800 border-slate-200 space-y-2.5 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex justify-between items-center">
            <span>Auto-save:</span>
            <span className={state.settings.autoSave ? "text-emerald-500 font-semibold" : "text-rose-500 font-semibold"}>
              {state.settings.autoSave ? "ON" : "OFF"}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span>Local DB Storage:</span>
            <span className="font-medium dark:text-slate-300 text-slate-700">{totalStorageSize()}</span>
          </div>
          <div className="text-center pt-2 dark:text-slate-600 text-slate-400 font-mono">
            v1.0.0 | Full-Stack Enabled
          </div>
        </div>
      </aside>

      {/* Main Panel Content container */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        
        {/* Header Ribbon / Navigation Bar */}
        <header className="flex items-center justify-between px-6 py-4 border-b dark:bg-slate-900/60 bg-white dark:border-slate-800 border-slate-200 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 rounded-lg lg:hidden hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400"
            >
              <Cpu size={20} />
            </button>
            
            {/* Context Header Text */}
            <h1 className="text-lg font-bold dark:text-white text-slate-800">
              {activeTab === "tokens-section" && "API Tokens & Credentials"}
              {activeTab === "config-section" && "AI Assistant Configurations"}
              {activeTab === "chat-section" && "Interactive Model Playground"}
              {activeTab === "settings-section" && "Settings Backup / Restore"}
              {activeTab === "activity-section" && "System Activity Logs"}
            </h1>
          </div>

          <div className="flex items-center gap-4">
            {/* Live Network Banner */}
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
                isOnline
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
              }`}
            >
              {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
              <span>{isOnline ? "Network Connected" : "Local-Only Mode"}</span>
            </div>

            {/* Dark Theme Button */}
            <button
              onClick={toggleTheme}
              className="p-2.5 rounded-xl border dark:border-slate-800 border-slate-200 dark:bg-slate-900 bg-slate-50 dark:hover:bg-slate-800 hover:bg-slate-100 text-slate-600 dark:text-slate-300 transition-all cursor-pointer"
              title="Toggle theme mode"
            >
              {state.settings.theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </header>

        {/* Dynamic Nav Tabs Main Content Scroll View */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          
          {/* TOKENS VIEW SECTION */}
          {activeTab === "tokens-section" && (
            <div className="space-y-6 max-w-5xl animate-fadeIn">
              
              {/* Header options controls */}
              <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                <div className="relative w-full sm:max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={16} />
                  <input
                    type="text"
                    placeholder="Search standard tokens..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 rounded-xl text-sm border focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-900 bg-white border-slate-200 dark:border-slate-800 dark:text-slate-100 text-slate-800"
                  />
                </div>
                
                <div className="flex gap-2 flex-wrap w-full sm:w-auto">
                  <button
                    onClick={copyAllTokens}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
                  >
                    <Copy size={14} />
                    <span>Copy All</span>
                  </button>

                  <button
                    onClick={() => revealAllTokens(false)}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
                  >
                    <EyeOff size={14} />
                    <span>Hide All</span>
                  </button>

                  <button
                    onClick={() => revealAllTokens(true)}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
                  >
                    <Eye size={14} />
                    <span>Reveal All</span>
                  </button>

                  <button
                    onClick={triggerManualSave}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-600 text-white shadow-lg shadow-indigo-500/10 transition-colors"
                  >
                    <Settings size={14} />
                    <span>Save State</span>
                  </button>
                </div>
              </div>

              {/* Security info card */}
              <div className="p-4 rounded-xl border bg-indigo-500/5 border-indigo-500/10 text-xs dark:text-indigo-300 text-indigo-700 flex items-start gap-3">
                <Key className="shrink-0 mt-0.5" size={16} />
                <p>
                  <strong>Secured Local State System:</strong> Your tokens are kept 100% locally inside your browser's private offline LocalStorage container. They are never sent anywhere except verified API endpoint requests matching your selected providers.
                </p>
              </div>

              {/* Grid block of tokens */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredProviders.map((prov) => {
                  const tokenValue = state.tokens[prov.id] || "";
                  const isValid = validateToken(prov.id, tokenValue);
                  const showToken = visibleTokenIds[prov.id] || false;

                  return (
                    <div
                      key={prov.id}
                      className="p-5 rounded-2xl border dark:bg-slate-900/40 bg-white dark:border-slate-800/80 border-slate-200 hover:shadow-lg dark:hover:border-slate-700/60 transition-all flex flex-col justify-between space-y-4"
                    >
                      <div>
                        {/* Title and validity indicator */}
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold dark:text-slate-200 text-slate-800">{prov.name}</span>
                          <span
                            className={`w-2.5 h-2.5 rounded-full ${
                              tokenValue
                                ? isValid
                                  ? "bg-emerald-500 shadow-sm shadow-emerald-500 glow-success"
                                  : "bg-rose-500 shadow-sm shadow-rose-500"
                                : "bg-slate-300 dark:bg-slate-700"
                            }`}
                            title={tokenValue ? (isValid ? "Pattern Format Valid" : "Invalid Prefix Structure") : "No Token"}
                          ></span>
                        </div>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                          {prov.prefix ? `Requires prefix pattern: "${prov.prefix}"` : "Generic API key token"}
                        </p>
                      </div>

                      {/* Controls Row */}
                      <div className="flex gap-1.5 items-center">
                        <div className="relative flex-1">
                          <input
                            type={showToken ? "text" : "password"}
                            placeholder={`sk-abc...`}
                            value={tokenValue}
                            onChange={(e) => handleTokenChange(prov.id, e.target.value)}
                            className="w-full pl-3 pr-8 py-2 text-xs rounded-xl border focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-950 bg-slate-50 border-slate-200 dark:border-slate-800/80 dark:text-slate-100 text-slate-800"
                          />
                          <button
                            onClick={() => toggleTokenVisibility(prov.id)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300 transition-colors"
                          >
                            {showToken ? <EyeOff size={13} /> : <Eye size={13} />}
                          </button>
                        </div>

                        <button
                          onClick={() => copyTokenToClipboard(prov.id)}
                          className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                          title="Copy Token"
                        >
                          <Copy size={13} />
                        </button>

                        <button
                          onClick={() => clearToken(prov.id)}
                          className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-900 text-rose-500 hover:text-rose-600"
                          title="Clear Token"
                        >
                          <Trash size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Custom Provider Token Entry Card */}
              <div className="p-6 rounded-2xl border dark:bg-slate-900/30 bg-white dark:border-slate-800 border-slate-200 space-y-4">
                <h3 className="text-sm font-bold tracking-tight dark:text-slate-200 text-slate-800">Custom Provider Endpoint Credentials</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold dark:text-slate-300 text-slate-700">Provider Label</label>
                    <input
                      type="text"
                      placeholder="e.g. Pinecone, Langchain, AWS Bedrock..."
                      value={state.tokens.custom?.name || ""}
                      onChange={(e) => handleCustomTokenChange("name", e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-950 bg-slate-50 border-slate-200 dark:border-slate-800 dark:text-slate-100 text-slate-800"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold dark:text-slate-300 text-slate-700">API Key Secret Value</label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          type={visibleTokenIds["custom"] ? "text" : "password"}
                          placeholder="Enter your custom credential string..."
                          value={state.tokens.custom?.value || ""}
                          onChange={(e) => handleCustomTokenChange("value", e.target.value)}
                          className="w-full pl-4 pr-10 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-950 bg-slate-50 border-slate-200 dark:border-slate-800 dark:text-slate-100 text-slate-800"
                        />
                        <button
                          onClick={() => toggleTokenVisibility("custom")}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300 transition-colors"
                        >
                          {visibleTokenIds["custom"] ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* AI MODEL CONFIGURATION VIEW */}
          {activeTab === "config-section" && (
            <div className="space-y-6 max-w-4xl animate-fadeIn">
              
              {/* Core Active Settings Grid */}
              <div className="p-6 rounded-2xl border dark:bg-slate-900/40 bg-white dark:border-slate-800 border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold dark:text-slate-300 text-slate-700">Active Provider Model</label>
                  <select
                    value={state.config.provider}
                    onChange={(e) => handleConfigChange("provider", e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-950 bg-slate-50 border-slate-200 dark:border-slate-800 dark:text-slate-100 text-slate-800"
                  >
                    <option value="gemini">Google Gemini AI</option>
                    <option value="openai">OpenAI (GPT-4 / GPT-3.5)</option>
                    <option value="anthropic">Anthropic (Claude Series)</option>
                    <option value="groq">Groq AI Cloud Services</option>
                    <option value="mistral">Mistral AI Engines</option>
                    <option value="openrouter">OpenRouter Hub API</option>
                    <option value="deepseek">DeepSeek AI Core</option>
                    <option value="custom">Custom Configuration Provider</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold dark:text-slate-300 text-slate-700">Active Model Name String</label>
                  <input
                    type="text"
                    value={state.config.model}
                    onChange={(e) => handleConfigChange("model", e.target.value)}
                    placeholder="e.g. gemini-3.5-flash, gpt-4o, claude-3-5-sonnet-latest"
                    className="w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-950 bg-slate-50 border-slate-200 dark:border-slate-800 dark:text-slate-100 text-slate-800"
                  />
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-xs font-bold dark:text-slate-300 text-slate-700">API Endpoint Base Route URL (Optional Override)</label>
                  <input
                    type="text"
                    value={state.config.baseUrl}
                    onChange={(e) => handleConfigChange("baseUrl", e.target.value)}
                    placeholder="Defaults to native provider routes. Override for proxies or local mock servers."
                    className="w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-950 bg-slate-50 border-slate-200 dark:border-slate-800 dark:text-slate-100 text-slate-800"
                  />
                </div>
              </div>

              {/* Collapsible Advanced Parameters Option Group */}
              <div className="border dark:border-slate-800 border-slate-200 rounded-2xl overflow-hidden">
                <button
                  onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                  className="w-full flex justify-between items-center px-6 py-4 dark:bg-slate-900 bg-slate-50 border-b dark:border-slate-800 border-slate-200 text-sm font-bold dark:text-slate-200 text-slate-800 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <span>Advanced Parameters Configuration Settings</span>
                  {isAdvancedOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>
                
                {isAdvancedOpen && (
                  <div className="p-6 dark:bg-slate-900/20 bg-white grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                    {/* Temperature Slider */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold dark:text-slate-300 text-slate-700">Temperature (Creativity)</span>
                        <span className="font-mono text-indigo-500 font-bold bg-indigo-500/10 px-2 py-0.5 rounded-md">{state.config.temperature}</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="2"
                        step="0.1"
                        value={state.config.temperature}
                        onChange={(e) => handleConfigChange("temperature", parseFloat(e.target.value))}
                        className="w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-slate-200 dark:bg-slate-800 accent-indigo-600 dark:accent-indigo-500"
                      />
                    </div>

                    {/* Max Output Tokens Slider */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold dark:text-slate-300 text-slate-700">Max Generation Tokens Limit</span>
                        <span className="font-mono text-indigo-500 font-bold bg-indigo-500/10 px-2 py-0.5 rounded-md">{state.config.maxTokens}</span>
                      </div>
                      <input
                        type="range"
                        min="256"
                        max="16384"
                        step="256"
                        value={state.config.maxTokens}
                        onChange={(e) => handleConfigChange("maxTokens", parseInt(e.target.value))}
                        className="w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-slate-200 dark:bg-slate-800 accent-indigo-600 dark:accent-indigo-500"
                      />
                    </div>

                    {/* Top P Slider */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold dark:text-slate-300 text-slate-700">Top P Nucleus Sampling</span>
                        <span className="font-mono text-indigo-500 font-bold bg-indigo-500/10 px-2 py-0.5 rounded-md">{state.config.topP}</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={state.config.topP}
                        onChange={(e) => handleConfigChange("topP", parseFloat(e.target.value))}
                        className="w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-slate-200 dark:bg-slate-800 accent-indigo-600 dark:accent-indigo-500"
                      />
                    </div>

                    {/* Presence Penalty Slider */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold dark:text-slate-300 text-slate-700">Presence Penalty</span>
                        <span className="font-mono text-indigo-500 font-bold bg-indigo-500/10 px-2 py-0.5 rounded-md">{state.config.presencePenalty}</span>
                      </div>
                      <input
                        type="range"
                        min="-2"
                        max="2"
                        step="0.1"
                        value={state.config.presencePenalty}
                        onChange={(e) => handleConfigChange("presencePenalty", parseFloat(e.target.value))}
                        className="w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-slate-200 dark:bg-slate-800 accent-indigo-600 dark:accent-indigo-500"
                      />
                    </div>

                    {/* Frequency Penalty Slider */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold dark:text-slate-300 text-slate-700">Frequency Penalty</span>
                        <span className="font-mono text-indigo-500 font-bold bg-indigo-500/10 px-2 py-0.5 rounded-md">{state.config.frequencyPenalty}</span>
                      </div>
                      <input
                        type="range"
                        min="-2"
                        max="2"
                        step="0.1"
                        value={state.config.frequencyPenalty}
                        onChange={(e) => handleConfigChange("frequencyPenalty", parseFloat(e.target.value))}
                        className="w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-slate-200 dark:bg-slate-800 accent-indigo-600 dark:accent-indigo-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* System and Prompt Guidelines section */}
              <div className="p-6 rounded-2xl border dark:bg-slate-900/40 bg-white dark:border-slate-800 border-slate-200 space-y-5">
                <div className="space-y-2">
                  <label className="text-xs font-bold dark:text-slate-300 text-slate-700">Global System Behavior Prompt Directive</label>
                  <textarea
                    rows={4}
                    value={state.config.systemPrompt}
                    onChange={(e) => handleConfigChange("systemPrompt", e.target.value)}
                    placeholder="Tell the model how it should act, restrict response fields, or output specifications..."
                    className="w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-950 bg-slate-50 border-slate-200 dark:border-slate-800 dark:text-slate-100 text-slate-800"
                  />
                </div>

                <div className="space-y-4 pt-2">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <label className="text-xs font-bold dark:text-slate-300 text-slate-700">Pre-Configured System Instructions Prompts</label>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-500 font-medium">Quick Presets:</span>
                      <button
                        onClick={() => loadPromptTemplate("code")}
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-600/10 text-indigo-500 dark:text-indigo-400 border border-indigo-500/10 hover:bg-indigo-600/20"
                      >
                        Code Generator
                      </button>
                      <button
                        onClick={() => loadPromptTemplate("translate")}
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-600/10 text-emerald-500 dark:text-emerald-400 border border-emerald-500/10 hover:bg-emerald-600/20"
                      >
                        Localization
                      </button>
                      <button
                        onClick={() => loadPromptTemplate("write")}
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-pink-600/10 text-pink-500 dark:text-pink-400 border border-pink-500/10 hover:bg-pink-600/20"
                      >
                        Creative Copy
                      </button>
                    </div>
                  </div>

                  <textarea
                    rows={3}
                    value={state.config.defaultPrompt}
                    onChange={(e) => handleConfigChange("defaultPrompt", e.target.value)}
                    placeholder="Template for user playground prompts..."
                    className="w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-950 bg-slate-50 border-slate-200 dark:border-slate-800 dark:text-slate-100 text-slate-800"
                  />
                </div>
              </div>

            </div>
          )}

          {/* CHAT PLAYGROUND SECTION */}
          {activeTab === "chat-section" && (
            <div className="flex gap-6 h-[calc(100vh-140px)] animate-fadeIn">
              
              {/* Sidebar Session List */}
              <div className="hidden md:flex flex-col w-64 border dark:border-slate-800 border-slate-200 rounded-2xl overflow-hidden dark:bg-slate-900/30 bg-white">
                <div className="p-4 border-b dark:border-slate-800 border-slate-200 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                  <span className="text-xs font-bold dark:text-slate-400 text-slate-500 uppercase tracking-wider">Histories</span>
                  <button
                    onClick={createNewChatSession}
                    className="p-1.5 rounded-lg bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 text-white transition-all shadow-md shadow-indigo-500/10"
                    title="New session"
                  >
                    <Plus size={14} />
                  </button>
                </div>

                <div className="flex-1 p-3 overflow-y-auto space-y-1">
                  {state.chat.map((session) => {
                    const isActive = session.id === state.activeChatId;
                    return (
                      <div
                        key={session.id}
                        onClick={() => updateStateAndSave((prev) => ({ ...prev, activeChatId: session.id }))}
                        className={`group flex items-center justify-between p-3 rounded-xl text-xs font-medium cursor-pointer transition-all ${
                          isActive
                            ? "bg-indigo-600/10 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20"
                            : "dark:text-slate-400 text-slate-600 dark:hover:bg-slate-800/50 hover:bg-slate-50 border border-transparent"
                        }`}
                      >
                        <span className="truncate max-w-[140px]">{session.name}</span>
                        <button
                          onClick={(e) => deleteChatSession(session.id, e)}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-rose-500/10 text-rose-500 transition-opacity"
                          title="Delete history"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Chat Viewport Area */}
              <div className="flex-1 flex flex-col border dark:border-slate-800 border-slate-200 rounded-2xl overflow-hidden bg-white dark:bg-slate-950/20">
                {/* Chat parameters top status banner */}
                <div className="px-5 py-3 border-b dark:border-slate-800 border-slate-200 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/30">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-400">Model Active:</span>
                    <span className="font-semibold dark:text-indigo-400 text-indigo-600 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/10">{state.config.model}</span>
                    <span className="text-slate-300 dark:text-slate-700">|</span>
                    <span className="text-slate-400">Tokens Estimate:</span>
                    <span className="font-mono text-slate-600 dark:text-slate-300 font-semibold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">{totalChatTokensEstimated}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => exportChatSession("txt")}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-xs font-semibold px-2.5"
                      title="Export TXT File"
                    >
                      TXT
                    </button>
                    <button
                      onClick={() => exportChatSession("json")}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-xs font-semibold px-2.5"
                      title="Export JSON"
                    >
                      JSON
                    </button>
                    <button
                      onClick={clearActiveChatMessages}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-rose-500 hover:text-rose-600 text-xs font-semibold px-2.5"
                      title="Clear Playground"
                    >
                      Clear Playground
                    </button>
                  </div>
                </div>

                {/* Messages Panel Container */}
                <div className="flex-1 p-5 overflow-y-auto space-y-4">
                  {currentChatSession?.messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-2">
                      <div className="p-4 bg-indigo-500/10 text-indigo-500 rounded-full border border-indigo-500/10">
                        <MessageSquare size={32} />
                      </div>
                      <h3 className="font-bold text-sm text-slate-400">Empty Chat Playground</h3>
                      <p className="text-xs text-slate-500 max-w-sm">
                        Enter your message prompt in the chat input block below to begin your dynamic interaction session.
                      </p>
                    </div>
                  ) : (
                    currentChatSession?.messages.map((m, index) => (
                      <div
                        key={index}
                        className={`flex flex-col max-w-[80%] ${
                          m.role === "user" ? "ml-auto items-end" : "mr-auto items-start"
                        }`}
                      >
                        <div
                          className={`p-4 rounded-2xl text-sm ${
                            m.role === "user"
                              ? "bg-indigo-600 text-white rounded-br-none"
                              : "bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 border dark:border-slate-800 border-slate-200 rounded-bl-none"
                          }`}
                        >
                          <div
                            className="markdown-body text-xs sm:text-sm"
                            dangerouslySetInnerHTML={{ __html: parseMarkdown(m.content) }}
                          />
                        </div>
                        <span className="text-[10px] text-slate-400 mt-1 px-1.5 font-mono">
                          {m.timestamp}
                        </span>
                      </div>
                    ))
                  )}

                  {/* Typing / Thinking effect Loader */}
                  {isAiLoading && (
                    <div className="flex flex-col items-start mr-auto max-w-[80%]">
                      <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-900 border dark:border-slate-800 border-slate-200 rounded-bl-none flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-400 animate-bounce"></span>
                        <span className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-400 animate-bounce [animation-delay:0.2s]"></span>
                        <span className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-400 animate-bounce [animation-delay:0.4s]"></span>
                      </div>
                      <span className="text-[10px] text-slate-400 mt-1 px-1.5 font-mono">
                        AI processing...
                      </span>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Message Input Bottom Action Bar */}
                <div className="p-4 border-t dark:border-slate-800 border-slate-200 dark:bg-slate-900/10 bg-slate-50/50">
                  <div className="flex gap-2">
                    <textarea
                      rows={1}
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      placeholder="Type your message prompt directive here... (Markdown supported)"
                      className="flex-1 px-4 py-3 rounded-xl border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-950 bg-white border-slate-200 dark:border-slate-800 dark:text-slate-100 text-slate-800"
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={isAiLoading || !chatInput.trim()}
                      className="px-5 rounded-xl bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/10 flex items-center justify-center transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                    >
                      <Send size={18} />
                    </button>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* IMPORT EXPORT / SETTINGS VIEW */}
          {activeTab === "settings-section" && (
            <div className="space-y-6 max-w-4xl animate-fadeIn">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Export Config Card */}
                <div className="p-6 rounded-2xl border dark:bg-slate-900/40 bg-white dark:border-slate-800 border-slate-200 space-y-4">
                  <div className="p-3 bg-indigo-500/10 text-indigo-500 rounded-xl border border-indigo-500/10 w-fit">
                    <Download size={22} />
                  </div>
                  <h3 className="text-base font-bold dark:text-slate-100 text-slate-800">Export App Configurations Backup</h3>
                  <p className="text-xs dark:text-slate-400 text-slate-600 leading-relaxed">
                    Download your local secure configuration parameters, including API Tokens, Model configs, and chat histories, into a serialized JSON backup file.
                  </p>
                  <button
                    onClick={handleExportBackup}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 shadow-md transition-colors"
                  >
                    <Download size={15} />
                    <span>Download JSON Backup</span>
                  </button>
                </div>

                {/* Import Config Card */}
                <div className="p-6 rounded-2xl border dark:bg-slate-900/40 bg-white dark:border-slate-800 border-slate-200 space-y-4">
                  <div className="p-3 bg-indigo-500/10 text-indigo-500 rounded-xl border border-indigo-500/10 w-fit">
                    <Upload size={22} />
                  </div>
                  <h3 className="text-base font-bold dark:text-slate-100 text-slate-800">Import Configuration Backup File</h3>
                  <p className="text-xs dark:text-slate-400 text-slate-600 leading-relaxed">
                    Restore and replace your entire local storage parameter profile by uploading an active exported configuration JSON backup file.
                  </p>
                  
                  <input
                    type="file"
                    ref={importFileRef}
                    accept=".json"
                    onChange={handleImportBackup}
                    className="hidden"
                  />
                  <button
                    onClick={() => importFileRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold dark:text-slate-300 text-slate-700 bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 hover:bg-slate-200 border dark:border-slate-700/60 border-slate-200 transition-colors"
                  >
                    <Upload size={15} />
                    <span>Upload Config Backup</span>
                  </button>
                </div>

              </div>

              {/* General App Properties Options */}
              <div className="p-6 rounded-2xl border dark:bg-slate-900/40 bg-white dark:border-slate-800 border-slate-200 space-y-5">
                <h3 className="text-sm font-bold tracking-tight dark:text-slate-200 text-slate-800">Interactive System Settings Options</h3>
                
                <div className="flex items-center justify-between pb-4 border-b dark:border-slate-800/60 border-slate-200">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold dark:text-slate-300 text-slate-700 block">Auto-Save State Loop</span>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 block">Automatically persist changes continuously inside the local storage.</span>
                  </div>
                  <button
                    onClick={() => {
                      updateStateAndSave((prev) => ({
                        ...prev,
                        settings: { ...prev.settings, autoSave: !prev.settings.autoSave }
                      }));
                      showToast(`Auto-save ${!state.settings.autoSave ? "enabled" : "disabled"}`);
                    }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                      state.settings.autoSave ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-800"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        state.settings.autoSave ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-rose-500 block">System Danger Zone System Reset</span>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 block">Permanently purge your entire token configuration parameter schema.</span>
                  </div>
                  <button
                    onClick={clearAllData}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-rose-500 hover:text-white bg-rose-500/10 hover:bg-rose-500 border border-rose-500/20 hover:border-transparent transition-all"
                  >
                    Reset Dashboard Data
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* SYSTEM RECENT ACTIVITY LOGS VIEW */}
          {activeTab === "activity-section" && (
            <div className="space-y-6 max-w-4xl animate-fadeIn">
              
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500 font-medium">Keep logs up to 50 active system transactions.</span>
                <button
                  onClick={() => {
                    updateStateAndSave((prev) => ({ ...prev, logs: [] }));
                    showToast("System activity history cleared", "info");
                  }}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-rose-500 hover:text-white bg-rose-500/10 hover:bg-rose-500 border border-rose-500/20 hover:border-transparent transition-all"
                >
                  Clear History Logs
                </button>
              </div>

              {/* Logs display shell list */}
              <div className="border dark:border-slate-800 border-slate-200 rounded-2xl overflow-hidden bg-white dark:bg-slate-900/30">
                <div className="p-4 border-b dark:border-slate-800 border-slate-200 bg-slate-50 dark:bg-slate-900/50 flex text-xs font-bold text-slate-400 uppercase tracking-wider">
                  <div className="w-24">Timestamp</div>
                  <div className="flex-1">Transaction Activity Directive Description</div>
                </div>

                <div className="divide-y dark:divide-slate-800 divide-slate-100 max-h-[500px] overflow-y-auto">
                  {state.logs.length === 0 ? (
                    <div className="p-12 text-center text-xs text-slate-400 font-medium leading-relaxed">
                      No system transactions completed in this current dashboard instance profile yet.
                    </div>
                  ) : (
                    state.logs.map((log, i) => (
                      <div key={i} className="flex items-center p-4 text-xs font-mono">
                        <div className="w-24 text-slate-400 shrink-0">{log.time}</div>
                        <div className="flex-1 dark:text-slate-200 text-slate-700 truncate">{log.message}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          )}

        </main>
      </div>

    </div>
  );
}
