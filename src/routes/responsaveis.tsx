import { createFileRoute } from "@tanstack/react-router";
import { Send, MessageSquare } from "lucide-react";
import { toast } from "sonner";

import { AdminShell } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { MOCK_DB, User } from "@/contexts/auth";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useState } from "react";

export const Route = createFileRoute("/responsaveis")({
  head: () => ({
    meta: [
      { title: "Responsáveis | Portal Escolar" },
      { name: "description", content: "Lista de responsáveis e seus filhos na escola." },
      { property: "og:title", content: "Responsáveis | Portal Escolar" },
      { property: "og:description", content: "Lista de responsáveis e seus filhos na escola." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResponsaveisPage,
});

function ResponsaveisPage() {
  const [messageTo, setMessageTo] = useState<User | null>(null);
  const [message, setMessage] = useState("");

  const handleSendMessage = () => {
    if (!message.trim()) {
      toast.error("A mensagem não pode estar vazia.");
      return;
    }
    toast.success(`Mensagem enviada para ${messageTo?.name}!`);
    setMessage("");
    setMessageTo(null);
  };

  const parents = MOCK_DB.users.filter((u) => u.role === "RESPONSAVEL");

  return (
    <AdminShell>
      <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8 sm:py-10">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold text-foreground">Responsáveis</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {parents.length} {parents.length === 1 ? "responsável cadastrado" : "responsáveis cadastrados"}
            </p>
          </div>
        </div>

        {parents.length === 0 ? (
          <div className="mt-12 text-center">
            <p className="text-sm text-muted-foreground">Nenhum responsável cadastrado ainda.</p>
          </div>
        ) : (
          <div className="mt-6 divide-y border-y">
            {parents.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-4 py-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{r.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{r.email}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => setMessageTo(r as User)}
                  >
                    <MessageSquare className="size-3.5" />
                    Enviar mensagem
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!messageTo} onOpenChange={() => setMessageTo(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Mensagem Direta</DialogTitle>
            <DialogDescription>
              Envie um comunicado particular para <strong>{messageTo?.name}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Label htmlFor="message">Sua mensagem</Label>
            <textarea
              id="message"
              placeholder="Digite aqui..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="mt-2 flex min-h-[100px] w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setMessageTo(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSendMessage}>
              <Send className="mr-2 size-4" />
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
