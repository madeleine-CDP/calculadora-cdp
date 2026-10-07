// ═══════════════════════════════════════════════════════
// Função "agenda" — lê a Agenda CLIENTES CDP (Google) para a tela Agenda do sistema.
// Acesso por uma PONTE: um Google Apps Script na conta madeleine@centraldaspersianas.com
// (arquivo google/agenda-ponte.gs). Esta função só repassa o pedido para a ponte.
// Segredos (Edge Functions → Secrets):
//   AGENDA_URL     = "URL do app da Web" da implantação do Apps Script
//   AGENDA_SEGREDO = o mesmo valor da propriedade SEGREDO do script
// Etapa 3A: SÓ LEITURA. Nada é criado nem alterado na agenda.
//
// Rotas (POST, só equipe):  status → { configurado, ok, nome }   eventos → { de, ate } → [eventos]
// ═══════════════════════════════════════════════════════
import { createClient } from "npm:@supabase/supabase-js@2";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const AGENDA_URL = (Deno.env.get("AGENDA_URL") ?? "").trim();
const AGENDA_SEGREDO = (Deno.env.get("AGENDA_SEGREDO") ?? "").trim();

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

// Chama a ponte (Apps Script). O Google responde com um redirecionamento, que o fetch segue sozinho.
async function ponte(corpo: Record<string, unknown>) {
  try { return await ponte1(corpo); }
  catch (e) {
    // O Google às vezes falha uma vez (ex.: logo depois de uma nova implantação): tenta de novo
    if ((e as Error).message !== "ponte_indisponivel") throw e;
    await new Promise((r) => setTimeout(r, 800));
    return await ponte1(corpo);
  }
}
async function ponte1(corpo: Record<string, unknown>) {
  const r = await fetch(AGENDA_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ ...corpo, segredo: AGENDA_SEGREDO }),
    redirect: "follow",
  });
  const t = await r.text().catch(() => "");
  let d: any = null;
  try { d = JSON.parse(t); } catch { d = null; }
  if (!r.ok || !d) {
    console.error("ponte", r.status, t.slice(0, 200).replace(/\s+/g, " "));
    throw new Error("ponte_indisponivel");
  }
  if (d.erro) throw new Error(String(d.erro));
  return d;
}

const ERROS_CONHECIDOS = ["nao_autorizado", "agenda_nao_encontrada", "periodo", "ponte_indisponivel"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  const rota = new URL(req.url).pathname.split("/").filter(Boolean).pop() ?? "";
  try {
    const p = await pessoaDaEquipe(req);
    if (!p) return json(req, { erro: "nao_autorizado" }, 401);
    const corpo = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const configurado = !!(AGENDA_URL && AGENDA_SEGREDO);

    if (rota === "status") {
      if (!configurado) return json(req, { configurado, ok: false });
      try {
        const d = await ponte({ acao: "status" });
        return json(req, { configurado, ok: true, nome: d.nome ?? "", fuso: d.fuso ?? "" });
      } catch (e) {
        const m = String((e as Error).message);
        // "nao_autorizado" aqui = segredo diferente entre o script e o Supabase
        return json(req, { configurado, ok: false, erro: m === "nao_autorizado" ? "segredo_diferente" : m });
      }
    }

    if (rota === "eventos") {
      if (!configurado) return json(req, { erro: "nao_configurado" }, 409);
      const de = new Date(String(corpo.de ?? "")), ate = new Date(String(corpo.ate ?? ""));
      if (isNaN(+de) || isNaN(+ate) || ate <= de || +ate - +de > 62 * 86400_000) return json(req, { erro: "periodo" }, 400);
      const d = await ponte({ acao: "eventos", de: de.toISOString(), ate: ate.toISOString() });
      const eventos = (d.eventos ?? []).slice().sort((a: any, b: any) => String(a.inicio).localeCompare(String(b.inicio)));
      return json(req, { eventos });
    }
    return json(req, { erro: "rota" }, 404);
  } catch (err) {
    let msg = String(err instanceof Error ? err.message : err);
    if (msg === "nao_autorizado") msg = "segredo_diferente";
    console.error(msg);
    return json(req, { erro: [...ERROS_CONHECIDOS, "segredo_diferente"].includes(msg) ? msg : "ponte_indisponivel" }, 502);
  }
});
