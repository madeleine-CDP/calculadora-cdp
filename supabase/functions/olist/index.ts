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
//   POST contato   → { id } → cadastro completo do cliente (celular, endereço) (equipe)
//   POST pedidos   → { cpfCnpj, nome } → últimos pedidos no Tiny, com a data de entrega das OS entregues (equipe)
//   POST posvenda  → lê as OS "Entregue" de 5 a 13 meses atrás e guarda a data real da instalação na tabela posvenda (equipe)
//   POST os        → lê as OS em andamento (aberta → entregue nos últimos 30 dias, com a nota fiscal) e guarda em os_acompanhamento (equipe)
//   POST os_numero → { numero } → OS do Tiny por número: valor, situação, cliente (para conferir com o orçamento) (equipe)
//   POST historico → { id?, cpfCnpj?, celular?, nome? } → cadastro + TODOS os pedidos de venda do cliente (os 12 mais recentes com itens e entrega) (equipe)
//   POST vendas    → { meses } → pedidos de venda criados nos últimos N meses (valor final, situação) para o painel Financeiro (equipe)
//   POST pedido    → { id } → pedido de venda completo (cliente, itens, totais, pagamento, parcelas, observações) para a tela de detalhe (equipe)
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
  const rotaTiny = caminho.split("?")[0];
  if (r.status === 404) { console.log("tiny 404", rotaTiny); return { itens: [] }; }
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    console.error("tiny erro", r.status, rotaTiny, t.slice(0, 300));
    // o Olist às vezes demora na busca por nome ("levou muito tempo"): tenta mais 1 vez
    if (r.status === 400 && /muito tempo/i.test(t) && tentativa === 0) {
      await new Promise((ok) => setTimeout(ok, 800));
      return tiny(caminho, 1);
    }
    throw new Error("olist_api " + r.status);
  }
  const d = await r.json();
  console.log("tiny ok", rotaTiny, (d?.itens ?? []).length);
  return d;
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
    tipoPessoa: c.tipoPessoa ?? "", inscricaoEstadual: c.inscricaoEstadual ?? "", numero: e.numero ?? "",
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
  const resultados = await Promise.allSettled(consultas.map((q) => tiny(`/contatos?${q}&limit=10`)));
  for (const r of resultados) {
    if (r.status !== "fulfilled") { console.error("busca falhou", String(r.reason)); if (String(r.reason).includes("desconectado")) throw r.reason; continue; }
    for (const c of r.value?.itens ?? []) if (c?.id && c.situacao !== "E" && !vistos.has(c.id)) vistos.set(c.id, cliente(c));
  }
  // todas as consultas falharam → avisa "indisponível" em vez de "nenhum cliente"
  if (consultas.length && resultados.every((r) => r.status !== "fulfilled")) throw new Error("olist_api todas");
  return [...vistos.values()].slice(0, 10);
}

const soData = (t: unknown) => { const m = String(t ?? "").match(/^\d{4}-\d{2}-\d{2}/); return m ? m[0] : null; };
// A lista do Olist não traz a data de entrega: ela vem do detalhe de cada OS
async function dataEntrega(id: number) {
  const d = await tiny(`/pedidos/${id}`);
  return soData(d?.dataEntrega) ?? soData(d?.dataPrevista);
}

async function pedidos(cpfCnpj: string, nome: string) {
  const q = so(cpfCnpj) ? "cpfCnpj=" + encodeURIComponent(cpfCnpj) : "nomeCliente=" + encodeURIComponent(nome);
  const d = await tiny(`/pedidos?${q}&orderBy=desc&limit=5`);
  const lista = (d?.itens ?? []).map((p: any) => ({
    id: p.id, numero: p.numeroPedido, data: p.dataCriacao ?? "", valor: Number(p.valor ?? 0),
    situacao: SITUACAO[String(p.situacao)] ?? String(p.situacao ?? ""), entregue: String(p.situacao) === "6", entrega: null as string | null,
  }));
  await Promise.all(lista.filter((p: any) => p.entregue && p.id).map(async (p: any) => { try { p.entrega = await dataEntrega(p.id); } catch { /* sem data */ } }));
  return lista;
}

// Pós-venda: guarda a data real da instalação das OS entregues (sem repetir consulta das que já foram lidas)
const isoDia = (d: Date) => d.toISOString().slice(0, 10);
async function sincronizarPosvenda() {
  const hoje = new Date();
  const ini = new Date(hoje); ini.setMonth(ini.getMonth() - 13);
  const fim = new Date(hoje); fim.setMonth(fim.getMonth() - 5);
  const achados: any[] = [];
  for (let off = 0; off < 500; off += 100) {
    const d = await tiny(`/pedidos?situacao=6&dataInicial=${isoDia(ini)}&dataFinal=${isoDia(fim)}&limit=100&offset=${off}`);
    const it = d?.itens ?? []; achados.push(...it);
    if (it.length < 100) break;
  }
  const ids = achados.map((p) => Number(p.id)).filter(Boolean);
  const { data: ja } = ids.length ? await admin.from("posvenda").select("pedido_id").in("pedido_id", ids) : { data: [] };
  const conhecidos = new Set((ja ?? []).map((r: any) => Number(r.pedido_id)));
  const novos = achados.filter((p) => p.id && !conhecidos.has(Number(p.id)));
  const lote = novos.slice(0, 25);   // no máximo 25 consultas por vez (limite do Olist: 60 por minuto)
  const linhas = [];
  for (const p of lote) {
    let entrega: string | null = null;
    try { entrega = await dataEntrega(Number(p.id)); } catch { continue; }
    const c = p.cliente ?? {};
    linhas.push({ pedido_id: Number(p.id), numero: String(p.numeroPedido ?? ""), cliente: c.nome ?? "", celular: c.celular || c.telefone || "", data_entrega: entrega });
  }
  if (linhas.length) await admin.from("posvenda").upsert(linhas, { onConflict: "pedido_id", ignoreDuplicates: true });
  return { lidos: linhas.length, faltam: novos.length - lote.length };
}

// ── OS em andamento (Fase 4 · Pedidos) ──
// Situações do Olist: 0 aberta · 3 aprovada · 4 preparando envio · 7 pronto p/ envio · 5 enviada · 1 faturada · 6 entregue
const ATIVAS = [0, 3, 4, 7, 5, 1];
// nº do pedido na fábrica (D2299 / R2249): no campo "nº da ordem de compra" da OS; se vazio, procura nas observações
function numeroFabrica(d: any) {
  const achar = (t: unknown) => (String(t ?? "").toUpperCase().match(/\b[DR]\s?-?\d{3,5}\b/g) ?? []).map((x) => x.replace(/[\s-]/g, ""));
  const l = [...achar(d?.numeroOrdemCompra), ...achar(d?.observacoesInternas), ...achar(d?.observacoes)];
  return [...new Set(l)].join(" / ") || (String(d?.numeroOrdemCompra ?? "").trim() || null);
}
// Serviços na OS (acompanhamento das OS de serviço, 20/11/2026): tipos de serviço nos itens, se há produto novo
// (cortina/persiana/toldo) e se a OS tem a tag "SERVIÇO" no Olist.
const RE_SERVICO = /(INSTALA|DESINSTALA|LAVAGEM|LAVAR|MANUTEN|CONSERTO|REPARO|REVIS[AÃ]O|AJUSTE|REDU[CÇ][AÃ]O D|TROCA D|SERVI[CÇ]O|M[AÃ]O DE OBRA|VISITA T[EÉ]CNICA)/i;
function lerItensServico(d: any) {
  const itens = (d?.itens ?? []).map((i: any) => ({ desc: String(i.produto?.descricao ?? i.descricao ?? ""), tipo: String(i.produto?.tipo ?? ""), qtd: num(i.quantidade) }));
  const tipos = new Set<string>();
  let temProduto = false;
  for (const i of itens) {
    const u = i.desc.toUpperCase();
    const servico = i.tipo === "S" || RE_SERVICO.test(u);
    if (servico) {
      if (/DESINSTALA/.test(u)) tipos.add("desinstalação");
      else if (/INSTALA/.test(u)) tipos.add("instalação");
      if (/LAVAGEM|LAVAR/.test(u)) tipos.add("lavagem");
      if (/MANUTEN|CONSERTO|REPARO|REVIS|M[AÃ]O DE OBRA/.test(u)) tipos.add("manutenção");
      if (/AJUSTE|REDU[CÇ][AÃ]O D|TROCA D/.test(u)) tipos.add("ajuste");
      if (/VISITA/.test(u)) tipos.add("visita");
      if (![...tipos].length) tipos.add("serviço");
    } else if (/CORTINA|PERSIANA|TOLDO/.test(u) && !/^([A-Z]+\s*[–-]\s*)?(CORDA|SUPORTE|TRILHO|PE[CÇ]A|COMPONENTE|ACESS[OÓ]RIO|CONTROLE|MOTOR\b|BAND[OÔ]|GUIA|TECIDO|CAT[AÁ]LOGO|AMOSTRA)/.test(u)) {
      temProduto = true;
    }
  }
  const marcadores = (d?.marcadores ?? []).map((m: any) => String(m?.descricao ?? m?.nome ?? m ?? ""));
  return {
    itens_resumo: itens.map((i: any) => (i.qtd && i.qtd !== 1 ? String(i.qtd).replace(".", ",") + "× " : "") + i.desc).join(" · ").slice(0, 1000) || null,
    servico_tipos: [...tipos].join(", ") || null,
    tem_produto: temProduto,
    marcado_servico: marcadores.some((m: string) => /SERVI[CÇ]O/i.test(m)),
    marcadores: marcadores.filter(Boolean).join(", ").slice(0, 500) || null,   // todas as tags (ex.: ATELIE), 20/11/2026
  };
}
async function sincronizarOS() {
  const hoje = new Date();
  const desde = new Date(hoje); desde.setDate(desde.getDate() - 30);   // entregues dos últimos 30 dias (avaliação + nota fiscal)
  const vistos = new Map<number, any>();
  for (const sit of ATIVAS) {
    for (let off = 0; off < 300; off += 100) {
      const d = await tiny(`/pedidos?situacao=${sit}&limit=100&offset=${off}`);
      const it = d?.itens ?? []; it.forEach((p: any) => vistos.set(Number(p.id), p));
      if (it.length < 100) break;
    }
  }
  // entregues recentemente (pedido de avaliação e nota fiscal)
  for (let off = 0; off < 300; off += 100) {
    const ent = await tiny(`/pedidos?situacao=6&dataAtualizacao=${isoDia(desde)}&limit=100&offset=${off}`);
    const it = ent?.itens ?? []; it.forEach((p: any) => vistos.set(Number(p.id), p));
    if (it.length < 100) break;
  }

  const ids = [...vistos.keys()];
  const { data: jaRows } = ids.length ? await admin.from("os_acompanhamento").select("pedido_id,situacao,numero_fabrica,data_entrega,nf_id,nf_numero,nf_situacao,nf_checado_em,itens_resumo,servico_tipos,tem_produto,marcado_servico,marcadores,itens_lidos_em").in("pedido_id", ids) : { data: [] };
  const ja = new Map((jaRows ?? []).map((r: any) => [Number(r.pedido_id), r]));
  const agora = new Date().toISOString();
  const linhas: any[] = [];
  let detalhes = 0;
  let notasBloqueadas = false;   // o aplicativo do Olist sem permissão de "notas fiscais" (403) ou limite atingido (429): não insiste nesta leitura
  const enviadasPorEmail: number[] = [];   // nota achada agora e cliente com e-mail no Olist → o Olist já mandou a NF por e-mail (regra A, Bru 13/10/2026)
  for (const [id, p] of vistos) {
    const sit = Number(p.situacao);
    const antes: any = ja.get(id);
    const c = p.cliente ?? {};
    const linha: any = {
      pedido_id: id, numero: String(p.numeroPedido ?? ""), cliente: c.nome ?? "", celular: c.celular || c.telefone || "",
      valor: Number(p.valor ?? 0), situacao: sit, data_venda: soData(p.dataCriacao), data_prevista: soData(p.dataPrevista), lido_em: agora,
      situacao_desde: antes && Number(antes.situacao) === sit ? undefined : agora,
      numero_fabrica: antes?.numero_fabrica ?? null, data_entrega: antes?.data_entrega ?? null,
      // nota fiscal: mantém o que já foi lido (o upsert em lote não pode apagar)
      nf_id: antes?.nf_id ?? null, nf_numero: antes?.nf_numero ?? null, nf_situacao: antes?.nf_situacao ?? null, nf_checado_em: antes?.nf_checado_em ?? null,
      // itens e serviços: idem (lidos uma vez do detalhe; de novo quando a situação muda, porque a OS pode ter sido editada)
      itens_resumo: antes?.itens_resumo ?? null, servico_tipos: antes?.servico_tipos ?? null, tem_produto: antes?.tem_produto ?? null,
      marcado_servico: antes?.marcado_servico ?? null, marcadores: antes?.marcadores ?? null, itens_lidos_em: antes?.itens_lidos_em ?? null,
    };
    // entregue sem nota ligada: procura de novo no máximo a cada 6h (limite de 60 consultas/min do Olist)
    const procurarNF = sit === 6 && !linha.nf_id && (!linha.nf_checado_em || Date.now() - new Date(linha.nf_checado_em).getTime() > 6 * 3600e3);
    // detalhe só quando precisa (nº da fábrica a partir da produção; data de entrega das entregues) — limite do Olist
    const precisa = ([4, 7, 5, 1, 6].includes(sit) && !linha.numero_fabrica) || (sit === 6 && !linha.data_entrega) || (antes && Number(antes.situacao) !== sit) || procurarNF || !linha.itens_lidos_em;
    if (precisa && detalhes < 25) {
      detalhes++;
      try {
        const d = await tiny(`/pedidos/${id}`);
        linha.numero_fabrica = numeroFabrica(d) ?? linha.numero_fabrica;
        linha.data_entrega = soData(d?.dataEntrega) ?? linha.data_entrega;
        if (d?.valorTotalPedido != null) linha.valor = Number(d.valorTotalPedido);
        if (Array.isArray(d?.itens)) Object.assign(linha, lerItensServico(d), { itens_lidos_em: agora });
        if (d?.idNotaFiscal) {
          linha.nf_id = Number(d.idNotaFiscal);
          if (!antes?.nf_id && String(d?.cliente?.email ?? "").includes("@")) enviadasPorEmail.push(id);
        }
        linha.nf_checado_em = agora;
      } catch { /* fica para a próxima leitura */ }
    }
    // nota ligada: nº e situação (de novo enquanto estiver pendente/em envio), no máximo a cada 6h por OS
    const notaVencida = !antes?.nf_checado_em || linha.nf_checado_em === agora || Date.now() - new Date(antes.nf_checado_em).getTime() > 6 * 3600e3;
    if (sit === 6 && linha.nf_id && !notasBloqueadas && notaVencida && (!linha.nf_numero || [null, 1, 4, 9].includes(linha.nf_situacao)) && detalhes < 40) {
      detalhes++;
      linha.nf_checado_em = agora;
      try {
        const n = await tiny(`/notas/${linha.nf_id}`);
        if (n) { linha.nf_numero = n.numero ? String(n.numero) : linha.nf_numero; linha.nf_situacao = n.situacao != null && n.situacao !== "" ? Number(n.situacao) : linha.nf_situacao; }
      } catch (e) { if (/ 40[13]| 429/.test(String(e))) notasBloqueadas = true; }
    }
    if (linha.situacao_desde === undefined) delete linha.situacao_desde;
    linhas.push(linha);
  }
  // as que saíram das listas (ex.: canceladas ou entregues há mais tempo): confere a situação real
  const { data: abertasAntes } = await admin.from("os_acompanhamento").select("pedido_id").in("situacao", ATIVAS);
  for (const r of abertasAntes ?? []) {
    const id = Number(r.pedido_id);
    if (vistos.has(id) || detalhes >= 40) continue;
    detalhes++;
    try {
      const d = await tiny(`/pedidos/${id}`);
      if (d?.situacao != null) {
        // atualização só dos campos lidos (não apaga cliente, nº etc.)
        const mud: any = { situacao: Number(d.situacao), situacao_desde: agora, lido_em: agora };
        const ent = soData(d?.dataEntrega); if (ent) mud.data_entrega = ent;
        const fab = numeroFabrica(d); if (fab) mud.numero_fabrica = fab;
        await admin.from("os_acompanhamento").update(mud).eq("pedido_id", id);
      }
    } catch { /* depois */ }
  }
  if (linhas.length) {
    // grava em duas levas: as que mudaram de situação (com a data) e as demais (sem mexer na data)
    const com = linhas.filter((l) => "situacao_desde" in l), sem = linhas.filter((l) => !("situacao_desde" in l));
    if (com.length) await admin.from("os_acompanhamento").upsert(com, { onConflict: "pedido_id" });
    if (sem.length) await admin.from("os_acompanhamento").upsert(sem, { onConflict: "pedido_id" });
  }
  // marca "enviada por e-mail pelo Olist" (só se ninguém marcou nada ainda; a equipe pode desfazer)
  if (enviadasPorEmail.length) {
    await admin.from("os_acompanhamento").update({ nf_enviada_em: agora, nf_enviada_por: "Olist (e-mail)" }).in("pedido_id", enviadasPorEmail).is("nf_enviada_em", null);
  }
  return { lidas: vistos.size, detalhes };
}
async function osPorNumero(numero: string) {
  const n = so(numero); if (!n) return null;
  const d = await tiny(`/pedidos?numero=${n}&limit=5`);
  const p = (d?.itens ?? []).find((x: any) => String(x.numeroPedido) === n) ?? (d?.itens ?? [])[0];
  if (!p) return null;
  let det: any = null; try { det = await tiny(`/pedidos/${p.id}`); } catch { det = null; }
  return {
    id: p.id, numero: String(p.numeroPedido ?? ""), cliente: p.cliente?.nome ?? "", situacao: SITUACAO[String(p.situacao)] ?? String(p.situacao ?? ""),
    valor: Number(det?.valorTotalPedido ?? p.valor ?? 0), desconto: Number(det?.valorDesconto ?? 0), numeroFabrica: det ? numeroFabrica(det) : null,
  };
}

// Detalhe do pedido de venda (= OS da loja) para a tela "Pedido nº …" na aba Pedidos. Só leitura.
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const nomeDe = (v: any) => (v && typeof v === "object" ? (v.nome ?? v.descricao ?? "") : String(v ?? ""));
async function pedidoDetalhe(id: number) {
  const d = await tiny(`/pedidos/${id}`);
  if (!d?.id) return null;
  let c = cliente(d.cliente ?? {});
  // o pedido às vezes traz o cliente resumido (sem endereço/celular): completa pelo cadastro
  if (d.cliente?.id && (!c.endereco || !(c.celular || c.telefone))) {
    try { const k = await tiny(`/contatos/${d.cliente.id}`); if (k?.id) { const kc = cliente(k); c = Object.fromEntries(Object.entries(c).map(([a, v]) => [a, v || (kc as any)[a]])) as typeof c; } } catch { /* fica o que veio */ }
  }
  const itens = (d.itens ?? []).map((i: any) => {
    const p = i.produto ?? {};
    const qtd = num(i.quantidade), unit = num(i.valorUnitario ?? i.valor);
    return {
      descricao: p.descricao ?? i.descricao ?? "", sku: p.sku ?? p.codigo ?? "", tipo: p.tipo ?? "",
      unidade: i.unidade ?? p.unidade ?? "", quantidade: qtd, valorUnitario: unit,
      total: num(i.valorTotal) || Math.round(qtd * unit * 100) / 100, detalhe: i.infoAdicional ?? i.informacoesAdicionais ?? "",
    };
  });
  const subtotal = num(d.valorTotalProdutos) || itens.reduce((t: number, i: any) => t + i.total, 0);
  const pg = d.pagamento ?? {};
  const parcelas = (pg.parcelas ?? []).map((x: any) => ({
    data: soData(x.data ?? x.dataVencimento), valor: num(x.valor), dias: x.dias ?? null,
    forma: nomeDe(x.formaRecebimento) || nomeDe(x.formaPagamento), meio: nomeDe(x.meioPagamento), obs: x.observacoes ?? x.obs ?? "",
  }));
  return {
    id: d.id, numero: String(d.numeroPedido ?? ""), situacao: SITUACAO[String(d.situacao)] ?? String(d.situacao ?? ""), situacaoCod: Number(d.situacao),
    data: soData(d.data ?? d.dataCriacao), dataPrevista: soData(d.dataPrevista), dataEntrega: soData(d.dataEntrega), dataEnvio: soData(d.dataEnvio),
    vendedor: nomeDe(d.vendedor), numeroFabrica: numeroFabrica(d), ordemCompra: d.numeroOrdemCompra ?? "",
    cliente: c, itens,
    subtotal, desconto: num(d.valorDesconto), frete: num(d.valorFrete ?? d.transportador?.valorFrete), outras: num(d.valorOutrasDespesas),
    total: num(d.valorTotalPedido) || subtotal - num(d.valorDesconto),
    pagamento: { forma: nomeDe(pg.formaRecebimento) || nomeDe(pg.formaPagamento), meio: nomeDe(pg.meioPagamento), condicao: pg.condicaoPagamento ?? d.condicaoPagamento ?? "", parcelas },
    observacoes: d.observacoes ?? "", observacoesInternas: d.observacoesInternas ?? "",
  };
}

// Histórico do cliente (busca + histórico): cadastro e todos os pedidos de venda. Só leitura.
const semAcento = (t: unknown) => String(t ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
async function historicoCliente(c: { id?: number; cpfCnpj?: string; celular?: string; nome?: string }) {
  let cad: ReturnType<typeof cliente> | null = null;
  if (c.id) { try { const k = await tiny(`/contatos/${c.id}`); if (k?.id) cad = cliente(k); } catch { /* segue */ } }
  if (!cad && (so(c.cpfCnpj).length >= 11 || so(c.celular).length >= 8)) {
    try { const l = await buscar(so(c.cpfCnpj).length >= 11 ? String(c.cpfCnpj) : String(c.celular)); cad = l[0] ?? null; } catch { /* segue */ }
  }
  if (!cad && String(c.nome ?? "").trim().length >= 3) {
    try { const l = await buscar(String(c.nome)); cad = l.find((x) => semAcento(x.nome) === semAcento(c.nome)) ?? null; } catch { /* segue */ }
  }
  if (cad?.id) { try { const k = await tiny(`/contatos/${cad.id}`); if (k?.id) cad = cliente(k); } catch { /* fica o resumo */ } }
  const doc = String(cad?.cpfCnpj || c.cpfCnpj || "");
  const nome = String(cad?.nome || c.nome || "");
  if (!so(doc) && nome.trim().length < 3) return { cliente: cad, pedidos: [] };
  const q = so(doc) ? "cpfCnpj=" + encodeURIComponent(doc) : "nomeCliente=" + encodeURIComponent(nome);
  const lista: any[] = [];
  for (let off = 0; off < 200; off += 100) {
    const d = await tiny(`/pedidos?${q}&orderBy=desc&limit=100&offset=${off}`);
    const it = d?.itens ?? []; lista.push(...it);
    if (it.length < 100) break;
  }
  // pela busca por nome, só os do mesmo nome (o Olist acha nomes parecidos)
  const doCliente = so(doc) ? lista : lista.filter((p) => semAcento(p.cliente?.nome) === semAcento(nome));
  const pedidos = doCliente.map((p: any) => ({
    id: Number(p.id), numero: String(p.numeroPedido ?? ""), data: soData(p.dataCriacao), valor: Number(p.valor ?? 0),
    situacaoCod: Number(p.situacao), situacao: SITUACAO[String(p.situacao)] ?? String(p.situacao ?? ""),
    itens: null as any, dataEntrega: null as string | null, dataPrevista: soData(p.dataPrevista), numeroFabrica: null as string | null, nf: false,
  })).sort((a: any, b: any) => String(b.data).localeCompare(String(a.data)));
  // detalhe (itens e data de entrega) dos 12 mais recentes, sem estourar o limite do Olist (60 por minuto)
  for (const p of pedidos.slice(0, 12)) {
    try {
      const d = await tiny(`/pedidos/${p.id}`);
      p.itens = (d?.itens ?? []).map((i: any) => ({ descricao: i.produto?.descricao ?? i.descricao ?? "", tipo: i.produto?.tipo ?? "", quantidade: num(i.quantidade) }));
      p.dataEntrega = soData(d?.dataEntrega); p.numeroFabrica = numeroFabrica(d); p.nf = !!d?.idNotaFiscal;
      if (d?.valorTotalPedido != null) p.valor = num(d.valorTotalPedido);
    } catch { /* fica sem detalhe */ }
  }
  return { cliente: cad, pedidos };
}

// Vendas (painel Financeiro e vendas): pedidos de venda criados nos últimos N meses (1 a 13), com o valor final. Só leitura.
async function vendasPeriodo(meses: number) {
  const n = Math.min(Math.max(Math.trunc(meses) || 6, 1), 13);
  const hoje = new Date();
  const ini = new Date(hoje.getFullYear(), hoje.getMonth() - (n - 1), 1);
  const lista: any[] = [];
  for (let off = 0; off < 3000; off += 100) {
    const d = await tiny(`/pedidos?dataInicial=${isoDia(ini)}&dataFinal=${isoDia(hoje)}&limit=100&offset=${off}`);
    const it = d?.itens ?? []; lista.push(...it);
    if (it.length < 100) break;
  }
  return {
    desde: isoDia(ini),
    pedidos: lista.map((p: any) => ({ id: Number(p.id), numero: String(p.numeroPedido ?? ""), data: soData(p.dataCriacao), valor: Number(p.valor ?? 0), situacao: Number(p.situacao), cliente: p.cliente?.nome ?? "" })),
  };
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
    if (rota === "contato") {
      // a lista do Olist vem resumida (às vezes sem celular/endereço): o cadastro completo vem daqui
      const id = Number(corpo.id);
      if (!Number.isInteger(id) || id <= 0) return json(req, { erro: "id" }, 400);
      const d = await tiny(`/contatos/${id}`);
      return json(req, { cliente: d?.id ? cliente(d) : null });
    }
    if (rota === "pedidos") return json(req, { pedidos: await pedidos(String(corpo.cpfCnpj ?? ""), String(corpo.nome ?? "")) });
    if (rota === "posvenda") return json(req, await sincronizarPosvenda());
    if (rota === "os") return json(req, await sincronizarOS());
    if (rota === "vendas") return json(req, await vendasPeriodo(Number(corpo.meses ?? 6)));
    if (rota === "historico") {
      const id = Number(corpo.id);
      return json(req, await historicoCliente({ id: Number.isInteger(id) && id > 0 ? id : undefined, cpfCnpj: String(corpo.cpfCnpj ?? ""), celular: String(corpo.celular ?? ""), nome: String(corpo.nome ?? "") }));
    }
    if (rota === "pedido") {
      const id = Number(corpo.id);
      if (!Number.isInteger(id) || id <= 0) return json(req, { erro: "id" }, 400);
      return json(req, { pedido: await pedidoDetalhe(id) });
    }
    if (rota === "os_numero") return json(req, { os: await osPorNumero(String(corpo.numero ?? "")) });

    return json(req, { erro: "rota" }, 404);
  } catch (err) {
    const msg = String(err instanceof Error ? err.message : err);
    if (msg.includes("desconectado")) return json(req, { erro: "desconectado" }, 409);
    console.error(msg);
    return json(req, { erro: "olist_indisponivel" }, 502);
  }
});
