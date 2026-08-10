import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const client = axios.create({ baseURL: API });

export const api = {
  chat: (session_id, message) => client.post("/chat", { session_id, message }).then((r) => r.data),
  history: (session_id) => client.get("/history", { params: { session_id } }).then((r) => r.data),
  clearHistory: (session_id) => client.delete("/history", { params: { session_id } }).then((r) => r.data),
  systemStats: () => client.get("/stats/system").then((r) => r.data),
  aiStats: () => client.get("/stats/ai").then((r) => r.data),
  recentCommands: () => client.get("/commands/recent").then((r) => r.data),
  quickCommands: () => client.get("/commands/quick").then((r) => r.data),
  notes: () => client.get("/notes").then((r) => r.data),
  addNote: (note) => client.post("/notes", note).then((r) => r.data),
  delNote: (id) => client.delete(`/notes/${id}`).then((r) => r.data),
  logs: () => client.get("/logs").then((r) => r.data),
  config: () => client.get("/config").then((r) => r.data),
  saveConfig: (patch) => client.put("/config", patch).then((r) => r.data),
  devices: () => client.get("/devices").then((r) => r.data),
  applications: () => client.get("/applications").then((r) => r.data),
  cyberTools: () => client.get("/cyber/tools").then((r) => r.data),
  gmailStatus: () => client.get("/gmail/status").then((r) => r.data),
  gmailRecent: () => client.get("/gmail/recent").then((r) => r.data),
  whatsapp: () => client.get("/whatsapp/recent").then((r) => r.data),
};

export const gmailLoginUrl = `${API}/oauth/gmail/login`;
