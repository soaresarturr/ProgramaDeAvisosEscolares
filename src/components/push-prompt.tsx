import { useEffect, useState } from "react";
import { BellRing, Share } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth";
import { type PushState, ativarPush, getPushState } from "@/lib/push";

/** Convite para o responsável receber os avisos no celular (some quando já está ativo). */
export function PushPrompt({ compact = false }: { compact?: boolean }) {
  const { user } = useAuth();
  const [state, setState] = useState<PushState>("carregando");
  const [ativando, setAtivando] = useState(false);

  useEffect(() => {
    void getPushState().then(setState);
  }, []);

  if (!user || state === "carregando" || state === "ativo" || state === "indisponivel") return null;

  const ativar = async () => {
    setAtivando(true);
    try {
      const novo = await ativarPush(user.id);
      setState(novo);
      if (novo === "ativo") toast.success("Pronto! Você vai receber os avisos neste celular.");
    } catch (e) {
      console.error("Erro ao ativar avisos:", e);
      const msg = e instanceof Error ? e.message : "";
      toast.error(
        msg.includes("VITE_VAPID_PUBLIC_KEY")
          ? "Avisos ainda não configurados no site (falta a chave pública de push)."
          : "Não foi possível ativar os avisos neste aparelho.",
      );
    } finally {
      setAtivando(false);
    }
  };

  const box = compact ? "px-4 py-3 text-xs" : "rounded-lg border bg-accent/40 p-4 text-sm";

  if (state === "ios-instalar") {
    return (
      <div className={box}>
        <p className="font-medium text-foreground">Receba os avisos no iPhone</p>
        <p className="mt-1 text-muted-foreground">
          Toque em <Share className="inline size-3.5 align-text-bottom" /> <strong>Compartilhar</strong> →{" "}
          <strong>Adicionar à Tela de Início</strong>. Depois abra o Portal pelo ícone e ative os avisos.
        </p>
      </div>
    );
  }

  if (state === "negado") {
    return (
      <div className={box}>
        <p className="text-muted-foreground">
          Os avisos estão bloqueados. Libere as notificações deste site nas configurações do navegador.
        </p>
      </div>
    );
  }

  return (
    <div className={`${box} flex flex-wrap items-center justify-between gap-3`}>
      <p className="text-muted-foreground">
        {compact ? "Receba os avisos mesmo com o site fechado." : "Receba os comunicados no celular, mesmo com o site fechado."}
      </p>
      <Button size="sm" onClick={() => void ativar()} disabled={ativando}>
        <BellRing className="size-4" />
        {ativando ? "Ativando..." : "Ativar avisos"}
      </Button>
    </div>
  );
}
