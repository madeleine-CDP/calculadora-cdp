// ═══════════════════════════════════════════════════════
// Função "agenda" — lê a Agenda CLIENTES CDP (Google) para a tela Agenda do sistema.
// Acesso por uma CONTA DE SERVIÇO do Google (robô) com quem a agenda foi compartilhada.
// Segredos (Edge Functions → Secrets): GOOGLE_SA_JSON (arquivo .json do robô, colado inteiro)
// e AGENDA_ID (ID da agenda CLIENTES CDP, em Configurações da agenda → "Integrar agenda").
// Etapa 3A: SÓ LEITURA. Nada é criado nem alterado na agenda.
//
// Rotas (POST, só equipe):  status → { configurado, ok, nome }   eventos → { de, ate } → [eventos]
// ═══════════════════════════════════════════════════════
import { createClient } from "npm:@supabase/supabase-js@2";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const AGENDA_ID = (Deno.env.get("AGENDA_ID") ?? "").trim();
let SA: { client_email?: string; private_key?: string } = {};
try { SA = JSON.parse(Deno.env.get("GOOGLE_SA_JSON") ?? "{}"); } catch { SA = {}; }

const ORIGENS_OK = [
  /^https:\/\/([a-z0-9-]+--)?sistemacdp\.netlify\.app$/,
  /^https:\/\/sistemacdp\.centraldaspersianas\.com(\.br)?$/,
  /^http:\/\/localhost(:\d+)?$/,
];
const origemOk = (o: string | null) => !!o && ORIGENS_OK.some((r) => r.test(o));
const admin = createClient(SB_URL, SB_SERVICE, { auth: { persistSession: false } });

function cors(req: Request): Record<string, string> {
  const o = req.headers.get("origin");
  return {
    "Access-Control-Allow-Origin": origemOk(o) ? o! : "https://sistemacdp.netlify.app",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}
const json = (req: Request, corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...cors(req), "Content-Type": "application/json" } });

async function pessoaDaEquipe(req: Request) {
  const tk = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!tk) return null;
  const { data, error } = await admin.auth.getUser(tk);
  if (error || !data.user?.email) return null;
  const { data: p } = await admin.from("perfis").select("nome,papel,email").eq("email", data.user.email).maybeSingle();
  return p ?? null;
}

// ── Token do Google para o robô (JWT assinado com a chave dele) ──
let TOKEN: { tk: string; exp: number } | null = null;
const b64url = (b: ArrayBuffer | Uint8Array | string) => {
  const bytes = typeof b === "string" ? new TextEncoder().encode(b) : new Uint8Array(b as ArrayBuffer);
  let s = ""; bytes.forEach((x) => s += String.fromCharCode(x));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
async function googleToken(): Promise<string> {
  if (TOKEN && TOKEN.exp - Date.now() > 120_000) return TOKEN.tk;
  if (!SA.client_email || !SA.private_key) throw new Error("sem_chave");
  const agora = Math.floor(Date.now() / 1000);
  const cab = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const corpo = b64url(JSON.stringify({
    iss: SA.client_email, scope: "https://www.googleapis.com/auth/calendar.events",
    aud: "https://oauth2.googleapis.com/token", iat: agora, exp: agora + 3600,
  }));
  const pem = SA.private_key.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const chave = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const ass = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", chave, new TextEncoder().encode(cab + "." + corpo));
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: cab + "." + corpo + "." + b64url(ass) }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.access_token) { console.error("google token", r.status, JSON.stringify(d).slice(0, 200)); throw new Error("google_token"); }
  TOKEN = { tk: d.access_token, exp: Date.now() + Number(d.expires_in ?? 3600) * 1000 };
  return TOKEN.tk;
}
async function google(caminho: string) {
  const tk = await googleToken();
  const r = await fetch("https://www.googleapis.com/calendar/v3" + caminho, { headers: { Authorization: "Bearer " + tk } });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    console.error("google", r.status, caminho.split("?")[0], t.slice(0, 200));
    throw new Error(r.status === 404 || r.status === 403 ? "sem_acesso" : "google_api");
  }
  return r.json();
}

function evento(e: any) {
  return {
    id: e.id,
    titulo: e.summary ?? "",
    inicio: e.start?.dateTime ?? e.start?.date ?? null,
    fim: e.end?.dateTime ?? e.end?.date ?? null,
    diaInteiro: !e.start?.dateTime,
    descricao: String(e.description ?? "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").slice(0, 2000),
    local: e.location ?? "",
    cor: e.colorId ?? null,
    link: e.htmlLink ?? "",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  const rota = new URL(req.url).pathname.split("/").filter(Boolean).pop() ?? "";
  try {
    const p = await pessoaDaEquipe(req);
    if (!p) return json(req, { erro: "nao_autorizado" }, 401);
    const corpo = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const configurado = !!(SA.client_email && SA.private_key && AGENDA_ID);

    if (rota === "status") {
      if (!configurado) return json(req, { configurado, ok: false, robo: SA.client_email ?? null });
      try {
        const c = await google(`/calendars/${encodeURIComponent(AGENDA_ID)}`);
        return json(req, { configurado, ok: true, nome: c.summary ?? "", fuso: c.timeZone ?? "", robo: SA.client_email });
      } catch (e) {
        return json(req, { configurado, ok: false, erro: String((e as Error).message), robo: SA.client_email });
      }
    }

    if (rota === "eventos") {
      if (!configurado) return json(req, { erro: "nao_configurado" }, 409);
      const de = new Date(String(corpo.de ?? "")), ate = new Date(String(corpo.ate ?? ""));
      if (isNaN(+de) || isNaN(+ate) || ate <= de || +ate - +de > 62 * 86400_000) return json(req, { erro: "periodo" }, 400);
      const q = new URLSearchParams({ timeMin: de.toISOString(), timeMax: ate.toISOString(), singleEvents: "true", orderBy: "startTime", maxResults: "250" });
      const d = await google(`/calendars/${encodeURIComponent(AGENDA_ID)}/events?${q}`);
      return json(req, { eventos: (d.items ?? []).filter((e: any) => e.status !== "cancelled").map(evento) });
    }
    return json(req, { erro: "rota" }, 404);
  } catch (err) {
    const msg = String(err instanceof Error ? err.message : err);
    console.error(msg);
    return json(req, { erro: ["sem_chave", "sem_acesso", "google_token"].includes(msg) ? msg : "google_indisponivel" }, 502);
  }
});
