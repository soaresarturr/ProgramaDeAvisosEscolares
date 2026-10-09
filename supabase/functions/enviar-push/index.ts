// Edge Function (Deno) que manda o Web Push de um comunicado novo para os celulares dos responsáveis.
//
// Quem chama: um Database Webhook do Supabase em INSERT na tabela "comunicados".
// Secrets necessários (Supabase → Edge Functions → Secrets), NUNCA no GitHub:
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (ex.: mailto:secretaria@escola.com.br),
//   PUSH_WEBHOOK_SECRET (o mesmo valor configurado no header x-webhook-secret do webhook).
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já existem automaticamente nas Edge Functions.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import webpush from "npm:web-push@3.6.7";

// Limpa erros comuns ao colar o secret no painel: espaços, aspas, "=" no fim
// e o nome da variável colado junto (ex.: "VITE_VAPID_PUBLIC_KEY=BBfm...").
function limparChave(valor: string | undefined) {
  const partes = (valor ?? "").trim().split(/\s+/); // "Private Key: abc..." → fica só "abc..."
  return (partes[partes.length - 1] ?? "")
    .replace(/^[A-Za-z_]+[=:]/, "")
    .replace(/^["']|["']$/g, "")
    .replace(/=+$/, "")
    .replace(/\+/g, "-") // base64 comum → base64 de URL
    .replace(/\//g, "_");
}

// Diagnóstico sem expor a chave: só o tamanho e se há caracteres inválidos
function descreverChave(nome: string, chave: string, tamanhoEsperado: number) {
  const invalidos = chave.replace(/[A-Za-z0-9_-]/g, "");
  return `${nome}: ${chave.length} caracteres (esperado ${tamanhoEsperado})` +
    (invalidos ? `, contém caracteres inválidos` : "");
}

const WEBHOOK_SECRET = Deno.env.get("PUSH_WEBHOOK_SECRET")?.trim();

const vapidPublica = limparChave(Deno.env.get("VAPID_PUBLIC_KEY"));
const vapidPrivada = limparChave(Deno.env.get("VAPID_PRIVATE_KEY"));

let erroVapid: string | null = null;
try {
  webpush.setVapidDetails(
    Deno.env.get("VAPID_SUBJECT")?.trim() || "mailto:secretaria@escola.local",
    vapidPublica,
    vapidPrivada,
  );
} catch (e) {
  erroVapid = `${e instanceof Error ? e.message : String(e)} | ` +
    `${descreverChave("pública", vapidPublica, 87)}; ${descreverChave("privada", vapidPrivada, 43)}`;
}

Deno.serve(async (req) => {
  // Só o webhook do próprio banco pode disparar envios
  if (!WEBHOOK_SECRET || req.headers.get("x-webhook-secret")?.trim() !== WEBHOOK_SECRET) {
    return new Response("unauthorized", { status: 401 });
  }
  if (erroVapid) {
    console.error("Chaves VAPID inválidas nos secrets:", erroVapid);
    return Response.json({ erro: `Chaves VAPID inválidas: ${erroVapid}` }, { status: 500 });
  }

  const payload = await req.json();
  if (payload?.type !== "INSERT" || payload?.table !== "comunicados" || !payload?.record?.id) {
    return Response.json({ ignorado: true });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Relê o comunicado no banco em vez de confiar no corpo da requisição
  const { data: comunicado, error: erroComunicado } = await supabase
    .from("comunicados")
    .select("id, titulo, mensagem")
    .eq("id", payload.record.id)
    .single();
  if (erroComunicado || !comunicado) {
    return Response.json({ erro: "comunicado não encontrado" }, { status: 404 });
  }

  const { data: destinos, error: erroDestinos } = await supabase.rpc("push_destinos", {
    p_comunicado_id: comunicado.id,
  });
  if (erroDestinos) return Response.json({ erro: erroDestinos.message }, { status: 500 });

  const mensagem = comunicado.mensagem.length > 140
    ? `${comunicado.mensagem.slice(0, 137)}...`
    : comunicado.mensagem;
  const corpo = JSON.stringify({
    title: comunicado.titulo,
    body: mensagem,
    url: "/comunicados",
    tag: comunicado.id,
  });

  const lista = (destinos ?? []) as { id: string; endpoint: string; p256dh: string; auth: string }[];
  const resultados = await Promise.allSettled(
    lista.map((d) =>
      webpush.sendNotification(
        { endpoint: d.endpoint, keys: { p256dh: d.p256dh, auth: d.auth } },
        corpo,
        { TTL: 60 * 60 * 24 }, // tenta entregar por até 1 dia se o celular estiver offline
      ),
    ),
  );

  // Aparelhos que desinstalaram/bloquearam respondem 404/410: removemos para não tentar de novo
  const expirados = lista
    .filter((_, i) => {
      const r = resultados[i];
      const status = r?.status === "rejected" ? (r.reason as { statusCode?: number })?.statusCode : undefined;
      return status === 404 || status === 410;
    })
    .map((d) => d.id);
  if (expirados.length > 0) {
    await supabase.from("push_subscriptions").delete().in("id", expirados);
  }

  const enviados = resultados.filter((r) => r.status === "fulfilled").length;
  return Response.json({ enviados, falhas: lista.length - enviados, removidos: expirados.length });
});
