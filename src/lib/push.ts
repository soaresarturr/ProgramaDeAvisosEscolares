// Web Push: deixa o celular do responsável receber os avisos com o site fechado.
// O envio em si acontece na Edge Function "enviar-push" do Supabase.
import { getSupabase } from "./supabase";

export type PushState =
  | "carregando"
  | "indisponivel" // navegador sem suporte
  | "ios-instalar" // iPhone: só funciona depois de "Adicionar à Tela de Início"
  | "negado" // a pessoa bloqueou as notificações
  | "inativo"
  | "ativo";

export function isIos() {
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function pushSuportado() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export async function getPushState(): Promise<PushState> {
  if (!pushSuportado()) return isIos() && !isStandalone() ? "ios-instalar" : "indisponivel";
  if (Notification.permission === "denied") return "negado";
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return sub ? "ativo" : "inativo";
}

function base64UrlToUint8Array(base64Url: string) {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

/** Pede permissão, registra este aparelho e guarda a assinatura no banco. */
export async function ativarPush(userId: string): Promise<PushState> {
  const vapidKey = import.meta.env["VITE_VAPID_PUBLIC_KEY"] as string | undefined;
  if (!vapidKey) throw new Error("Configure VITE_VAPID_PUBLIC_KEY no .env");

  const permissao = await Notification.requestPermission();
  if (permissao !== "granted") return permissao === "denied" ? "negado" : "inativo";

  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToUint8Array(vapidKey),
    }));

  const { endpoint, keys } = sub.toJSON();
  if (!endpoint || !keys?.["p256dh"] || !keys["auth"]) throw new Error("Assinatura de push incompleta");

  const { error } = await getSupabase()
    .from("push_subscriptions")
    .upsert(
      { user_id: userId, endpoint, p256dh: keys["p256dh"], auth: keys["auth"] },
      { onConflict: "endpoint" },
    );
  if (error) throw error;
  return "ativo";
}

/**
 * Ao sair da conta, este aparelho para de receber os avisos dela
 * (importante quando o celular é compartilhado na família).
 */
export async function desativarPushDesteAparelho() {
  if (!pushSuportado()) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await getSupabase().from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
  await sub.unsubscribe();
}
