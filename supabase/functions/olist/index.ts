// ═══════════════════════════════════════════════════════
// Função "olist" — a única peça que conversa com o Olist (Tiny API v3).
// Roda no servidor do Supabase. A chave do Olist (OLIST_CLIENT_ID / OLIST_CLIENT_SECRET)
// fica nos segredos das Edge Functions, nunca no site.
//
// Rotas (todas em /functions/v1/olist/...):
//   POST status    → a conexão com o Olist está ativa?            (equipe)
//   POST iniciar   → devolve o link para autorizar no Olist        (Bruna / Madeleine)
//   GET  callback  → o Olist volta aqui depois da autorização      (navegador)
//   POST buscar    → { termo } → clientes por nome, celular ou CPF (equipe)
//   POST pedidos   → { cpfCnpj, nome } → últimos pedidos no Tiny    (equipe)
//   POST renovar   → renova a autorização (agendamento a cada 3h)  (aberto; não devolve dados)
// Só leitura no Tiny: nada é criado nem alterado lá.
// ═══════════════════════════════════════════════════════
import { createClient } from "npm:@supabase/supabase-js@2";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CLIENT_ID = Deno.env.get("OLIST_CLIENT_ID") ?? "";
const CLIENT_SECRET = Deno.env.get("OLIST_CLIENT_SECRET") ?? "";

const AUTH_URL = "https://accounts.tiny.com.br/realms/tiny/protocol/openid-connect/auth";
const TOKEN_URL = "https://accounts.tiny.com.br/realms/tiny/protocol/openid-connect/token";
const API = "https://api.tiny.com.br/public-api/v3";
const REDIRECT_URI = `${SB_URL}/functions/v1/olist/callback`;

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
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Vary": "Origin",
  };
}
function json(req: Request, corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), { status, headers: { ...cors(req), "Content-Type": "application/json" } });
}

// Quem está chamando? Precisa estar logado no sistema E estar na equipe (perfis).
async function pessoaDaEquipe(req: Request) {
  const tk = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!tk) return null;
  const { data, error } = await admin.auth.getUser(tk);
  if (error || !data.user?.email) return null;
  const { data: p } = await admin.from("perfis").select("nome,papel,email").eq("email", data.user.email).maybeSingle();
  return p ?? null;
}

// ── Autorização do Olist ──
async function pedirToken(params: Record<string, string>) {
  const r = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, ...params }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.access_token) throw new Error("olist_token " + r.status + " " + (d.error ?? ""));
  return d;
}
async function gravarTokens(d: Record<string, unknown>, por?: string) {
  const agora = Date.now();
  const linha: Record<string, unknown> = {
    id: 1,
    access_token: d.access_token,
    refresh_token: d.refresh_token,
    access_expira: new Date(agora + Number(d.expires_in ?? 14400) * 1000).toISOString(),
    refresh_expira: new Date(agora + Number(d.refresh_expires_in ?? 86400) * 1000).toISOString(),
    atualizado_em: new Date(agora).toISOString(),
  };
  if (por) linha.conectado_por = por;
  await admin.from("olist_conexao").upsert(linha);
}
async function renovar() {
  const { data: c } = await admin.from("olist_conexao").select("*").eq("id", 1).maybeSingle();
  if (!c?.refresh_token) throw new Error("desconectado");
  if (c.refresh_expira && new Date(c.refresh_expira).getTime() < Date.now()) throw new Error("desconectado");
  const d = await pedirToken({ grant_type: "refresh_token", refresh_token: c.refresh_token });
  await gravarTokens(d);
  return d.access_token as string;
}
async function tokenValido() {
  const { data: c } = await admin.from("olist_conexao").select("*").eq("id", 1).maybeSingle();
  if (!c?.access_token) throw new Error("desconectado");
  if (c.access_expira && new Date(c.access_expira).getTime() - Date.now() > 60_000) return c.access_token as string;
  return renovar();
}
async function tiny(caminho: string, tentativa = 0): Promise<any> {
  const tk = await tokenValido();
  const r = await fetch(API + caminho, { headers: { Authorization: "Bearer " + tk, Accept: "application/json" } });
  if (r.status === 401 && tentativa === 0) { await renovar(); return tiny(caminho, 1); }
  if (r.status === 404) return { itens: [] };
  if (!r.ok) throw new Error("olist_api " + r.status);
  return r.json();
}

// ── Formatação ──
const so = (t: unknown) => String(t ?? "").replace(/\D/g, "");
function fmtCel(d: string) {
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return d;
}
function fmtDoc(d: string) {
  if (d.length === 11) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  if (d.length === 14) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  return d;
}
function cliente(c: any) {
  const e = c.endereco ?? {};
  const rua = [e.endereco, e.numero].filter(Boolean).join(", ") + (e.complemento ? " - " + e.complemento : "");
  return {
    id: c.id, nome: c.nome ?? "", fantasia: c.fantasia ?? "", cpfCnpj: c.cpfCnpj ?? "",
    celular: c.celular ?? "", telefone: c.telefone ?? "", email: c.email ?? "",
    endereco: rua, bairro: e.bairro ?? "", cidade: [e.municipio, e.uf].filter(Boolean).join("/"), cep: e.cep ?? "",
    situacao: c.situacao ?? "",
  };
}
const SITUACAO: Record<string, string> = {
  "8": "Dados incompletos", "0": "Aberta", "3": "Aprovada", "4": "Preparando envio", "1": "Faturada",
  "7": "Pronto para envio", "5": "Enviada", "6": "Entregue", "10": "Em devolução", "2": "Cancelada", "9": "Não entregue",
};

async function buscar(termo: string) {
  const t = termo.trim();
  const dig = so(t);
  const consultas: string[] = [];
  if (dig.length >= 8 && dig.length === t.replace(/[\s().\-\/+]/g, "").length) {
    const cel = dig.length > 11 && dig.startsWith("55") ? dig.slice(2) : dig;
    consultas.push("celular=" + encodeURIComponent(fmtCel(cel)), "celular=" + encodeURIComponent(cel));
    if (dig.length === 11 || dig.length === 14) consultas.push("cpfCnpj=" + encodeURIComponent(fmtDoc(dig)), "cpfCnpj=" + dig);
  } else if (t.length >= 3) {
    consultas.push("nome=" + encodeURIComponent(t));
  }
  const vistos = new Map<number, ReturnType<typeof cliente>>();
  const resultados = await Promise.allSettled(consultas.map((q) => tiny(`/contatos?${q}&limit=10&orderBy=desc`)));
  for (const r of resultados) {
    if (r.status !== "fulfilled") { if (String(r.reason).includes("desconectado")) throw r.reason; continue; }
    for (const c of r.value?.itens ?? []) if (c?.id && c.situacao !== "E" && !vistos.has(c.id)) vistos.set(c.id, cliente(c));
  }
  return [...vistos.values()].slice(0, 10);
}

async function pedidos(cpfCnpj: string, nome: string) {
  const q = so(cpfCnpj) ? "cpfCnpj=" + encodeURIComponent(cpfCnpj) : "nomeCliente=" + encodeURIComponent(nome);
  const d = await tiny(`/pedidos?${q}&orderBy=desc&limit=5`);
  return (d?.itens ?? []).map((p: any) => ({
    numero: p.numeroPedido, data: p.dataCriacao ?? "", valor: Number(p.valor ?? 0),
    situacao: SITUACAO[String(p.situacao)] ?? String(p.situacao ?? ""),
  }));
}

// ── Rotas ──
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  const rota = new URL(req.url).pathname.split("/").filter(Boolean).pop() ?? "";

  try {
    if (rota === "callback") {
      const u = new URL(req.url);
      const estado = u.searchParams.get("state") ?? "", code = u.searchParams.get("code") ?? "";
      const { data: e } = await admin.from("olist_estado").select("*").eq("estado", estado).maybeSingle();
      if (!e) return new Response("Pedido de conexão não encontrado ou vencido. Volte ao sistema e tente de novo.", { status: 400 });
      await admin.from("olist_estado").delete().eq("estado", estado);
      const volta = new URL(e.voltar);
      if (Date.now() - new Date(e.criado_em).getTime() > 15 * 60_000 || !code) {
        volta.searchParams.set("olist", "erro");
      } else {
        const d = await pedirToken({ grant_type: "authorization_code", code, redirect_uri: REDIRECT_URI });
        const { data: p } = await admin.from("perfis").select("nome").eq("email", e.email).maybeSingle();
        await gravarTokens(d, p?.nome ?? e.email);
        volta.searchParams.set("olist", "conectado");
      }
      return Response.redirect(volta.toString(), 302);
    }

    if (rota === "renovar") {
      await admin.from("olist_estado").delete().lt("criado_em", new Date(Date.now() - 3600_000).toISOString());
      // renova no máximo a cada 30 min (a rota é aberta para o agendamento; assim ninguém consegue abusar)
      const { data: c } = await admin.from("olist_conexao").select("atualizado_em").eq("id", 1).maybeSingle();
      if (c?.atualizado_em && Date.now() - new Date(c.atualizado_em).getTime() < 30 * 60_000) return json(req, { ok: true, recente: true });
      try { await renovar(); return json(req, { ok: true }); } catch { return json(req, { ok: false }); }
    }

    const p = await pessoaDaEquipe(req);
    if (!p) return json(req, { erro: "nao_autorizado" }, 401);
    const corpo = req.method === "POST" ? await req.json().catch(() => ({})) : {};

    if (rota === "status") {
      const { data: c } = await admin.from("olist_conexao").select("refresh_expira,conectado_por,atualizado_em").eq("id", 1).maybeSingle();
      const ativo = !!c?.refresh_expira && new Date(c.refresh_expira).getTime() > Date.now();
      return json(req, { configurado: !!(CLIENT_ID && CLIENT_SECRET), conectado: ativo, conectadoPor: c?.conectado_por ?? null, atualizadoEm: c?.atualizado_em ?? null });
    }

    if (rota === "iniciar") {
      if (!["admin", "dona"].includes(p.papel)) return json(req, { erro: "so_admin" }, 403);
      if (!CLIENT_ID || !CLIENT_SECRET) return json(req, { erro: "sem_chave" }, 400);
      const voltar = String(corpo.voltar ?? "");
      if (!origemOk((() => { try { return new URL(voltar).origin; } catch { return null; } })())) return json(req, { erro: "origem" }, 400);
      const estado = crypto.randomUUID();
      await admin.from("olist_estado").insert({ estado, email: p.email, voltar });
      const u = new URL(AUTH_URL);
      u.search = new URLSearchParams({ client_id: CLIENT_ID, redirect_uri: REDIRECT_URI, scope: "openid", response_type: "code", state: estado }).toString();
      return json(req, { url: u.toString() });
    }

    if (rota === "buscar") return json(req, { clientes: await buscar(String(corpo.termo ?? "")) });
    if (rota === "pedidos") return json(req, { pedidos: await pedidos(String(corpo.cpfCnpj ?? ""), String(corpo.nome ?? "")) });

    return json(req, { erro: "rota" }, 404);
  } catch (err) {
    const msg = String(err instanceof Error ? err.message : err);
    if (msg.includes("desconectado")) return json(req, { erro: "desconectado" }, 409);
    console.error(msg);
    return json(req, { erro: "olist_indisponivel" }, 502);
  }
});
