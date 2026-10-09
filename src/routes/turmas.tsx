import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Trash2, QrCode, Copy } from "lucide-react";
import { toast } from "sonner";

import { requireStaff } from "@/lib/session";
import { AdminShell } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  type Turma,
  buildTurmaCode,
  dbErrorMessage,
  useRemoverTurma,
  useSalvarTurma,
  useTurmas,
} from "@/lib/db";
import { useAuth } from "@/contexts/auth";

const CURRENT_YEAR = new Date().getFullYear();

/* ── Route ────────────────────────────────────────────────────── */

export const Route = createFileRoute("/turmas")({
  beforeLoad: requireStaff,
  head: () => ({
    meta: [
      { title: "Turmas | Portal Escolar" },
      { name: "description", content: "Gerencie as turmas da escola." },
      { property: "og:title", content: "Turmas | Portal Escolar" },
      { property: "og:description", content: "Gerencie as turmas da escola." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TurmasPage,
});

/* ── Component ────────────────────────────────────────────────── */

function TurmasPage() {
  const { user } = useAuth();
  const { data: turmas = [], isLoading } = useTurmas();
  const salvarTurma = useSalvarTurma();
  const removerTurma = useRemoverTurma();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTurma, setEditingTurma] = useState<Turma | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Turma | null>(null);
  const [shareTurma, setShareTurma] = useState<Turma | null>(null);

  // Form state
  const [formAno, setFormAno] = useState("");
  const [formSufixo, setFormSufixo] = useState("");
  const [formAnoLetivo, setFormAnoLetivo] = useState(String(CURRENT_YEAR));
  const [formError, setFormError] = useState("");

  function resetForm() {
    setFormAno("");
    setFormSufixo("");
    setFormAnoLetivo(String(CURRENT_YEAR));
    setFormError("");
  }

  function openCreate() {
    setEditingTurma(null);
    resetForm();
    setDialogOpen(true);
  }

  function openEdit(turma: Turma) {
    setEditingTurma(turma);
    setFormAno(turma.ano);
    setFormSufixo(turma.sufixo);
    setFormAnoLetivo(String(turma.anoLetivo));
    setFormError("");
    setDialogOpen(true);
  }

  function validate(ano: string, sufixo: string, anoLetivo: string, excludeId?: string): string | null {
    if (!ano.trim()) return "Informe o ano da turma (ex: J, 1, 2).";
    if (ano.trim().length !== 1 || !/^[A-Z0-9]$/i.test(ano.trim())) return "O ano deve ter exatamente 1 letra ou número.";
    if (!sufixo.trim()) return "Informe o sufixo da turma (ex: A, B, 1A).";
    if (!anoLetivo.trim()) return "Informe o ano letivo.";

    const anoLetivoNum = Number(anoLetivo);
    if (isNaN(anoLetivoNum) || anoLetivoNum < 2000 || anoLetivoNum > 2100) {
      return "Ano letivo inválido.";
    }

    // Check duplicates (same ano + sufixo + anoLetivo)
    const code = buildTurmaCode(ano.trim().toUpperCase(), sufixo.trim().toUpperCase());
    const duplicate = turmas.find(
      (t) =>
        buildTurmaCode(t.ano, t.sufixo) === code &&
        t.anoLetivo === anoLetivoNum &&
        t.id !== excludeId,
    );
    if (duplicate) return `A turma "${code}" já existe em ${anoLetivoNum}.`;

    return null;
  }

  function handleSave() {
    const error = validate(formAno, formSufixo, formAnoLetivo, editingTurma?.id);
    if (error) {
      setFormError(error);
      return;
    }

    const ano = formAno.trim().toUpperCase();
    const sufixo = formSufixo.trim().toUpperCase();
    const anoLetivo = Number(formAnoLetivo);

    salvarTurma.mutate(
      { ano, sufixo, anoLetivo, ...(editingTurma ? { id: editingTurma.id } : {}) },
      {
        onSuccess: () => {
          toast.success(
            editingTurma
              ? `Turma "${buildTurmaCode(ano, sufixo)}" atualizada.`
              : `Turma "${buildTurmaCode(ano, sufixo)}" criada para ${anoLetivo}.`,
          );
          setDialogOpen(false);
        },
        onError: (e) => setFormError(dbErrorMessage(e)),
      },
    );
  }

  function handleDelete(turma: Turma) {
    removerTurma.mutate(turma.id, {
      onSuccess: () => toast.success(`Turma "${buildTurmaCode(turma.ano, turma.sufixo)}" removida.`),
      onError: (e) =>
        toast.error(
          (e as { code?: string }).code === "23503"
            ? "Essa turma ainda tem alunos. Mude os alunos de turma antes de remover."
            : dbErrorMessage(e),
        ),
    });
    setDeleteConfirm(null);
  }

  const canManage = user?.role === "ADMIN" || user?.role === "DEV" || user?.role === "PROFESSOR";

  // Group by anoLetivo, then sort within
  const anosLetivos = [...new Set(turmas.map((t) => t.anoLetivo))].sort((a, b) => b - a);

  const turmasByAno = (anoLetivo: number) =>
    turmas
      .filter((t) => t.anoLetivo === anoLetivo)
      .sort((a, b) => a.ano.localeCompare(b.ano) || a.sufixo.localeCompare(b.sufixo));

  return (
    <AdminShell>
      <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8 sm:py-10">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold text-foreground">Turmas</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {turmas.length} {turmas.length === 1 ? "turma cadastrada" : "turmas cadastradas"}
            </p>
          </div>
          <Button
            id="btn-add-turma"
            className="h-10 self-start px-4 sm:h-11 sm:self-auto sm:px-6"
            onClick={openCreate}
          >
            <Plus className="size-4" />
            Adicionar turma
          </Button>
        </div>

        {isLoading ? (
          <p className="mt-12 text-center text-sm text-muted-foreground">Carregando...</p>
        ) : turmas.length === 0 ? (
          <div className="mt-12 text-center">
            <p className="text-sm text-muted-foreground">Nenhuma turma cadastrada ainda.</p>
            {canManage && (
              <Button variant="outline" className="mt-4" onClick={openCreate}>
                <Plus className="size-4" />
                Criar primeira turma
              </Button>
            )}
          </div>
        ) : (
          anosLetivos.map((anoLetivo) => (
            <div key={anoLetivo} className="mt-6">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Ano letivo {anoLetivo}
              </h2>
              <div className="mt-2 divide-y border-y">
                {turmasByAno(anoLetivo).map((t) => (
                  <div key={t.id} className="flex items-center justify-between gap-4 py-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        Turma {buildTurmaCode(t.ano, t.sufixo)}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {t.totalAlunos} {t.totalAlunos === 1 ? "aluno" : "alunos"}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-primary"
                        aria-label={`Compartilhar turma ${buildTurmaCode(t.ano, t.sufixo)}`}
                        onClick={() => setShareTurma(t)}
                      >
                        <QrCode className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-foreground"
                        aria-label={`Editar turma ${buildTurmaCode(t.ano, t.sufixo)}`}
                        onClick={() => openEdit(t)}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-destructive"
                        aria-label={`Remover turma ${buildTurmaCode(t.ano, t.sufixo)}`}
                        onClick={() => setDeleteConfirm(t)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingTurma ? "Editar turma" : "Nova turma"}</DialogTitle>
            <DialogDescription>
              Preencha o ano, o sufixo e o ano letivo da turma.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="turma-ano">Ano da turma</Label>
                <Input
                  id="turma-ano"
                  placeholder="Ex: J, 1, 2"
                  value={formAno}
                  maxLength={1}
                  onChange={(e) => {
                    setFormAno(e.target.value.toUpperCase());
                    setFormError("");
                  }}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="turma-sufixo">Sufixo</Label>
                <Input
                  id="turma-sufixo"
                  placeholder="Ex: A, B, C"
                  value={formSufixo}
                  maxLength={10}
                  onChange={(e) => {
                    setFormSufixo(e.target.value.toUpperCase());
                    setFormError("");
                  }}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="turma-ano-letivo">Ano letivo</Label>
              <Input
                id="turma-ano-letivo"
                type="number"
                placeholder={String(CURRENT_YEAR)}
                value={formAnoLetivo}
                min={2000}
                max={2100}
                onChange={(e) => {
                  setFormAnoLetivo(e.target.value);
                  setFormError("");
                }}
              />
            </div>

            {/* Live preview */}
            {formAno.trim() && formSufixo.trim() && (
              <p className="text-xs text-muted-foreground">
                Resultado:{" "}
                <strong className="text-foreground">
                  Turma {buildTurmaCode(formAno.trim().toUpperCase(), formSufixo.trim().toUpperCase())}
                </strong>
                {formAnoLetivo && (
                  <> · {formAnoLetivo}</>
                )}
              </p>
            )}

            {formError && <p className="text-sm text-destructive">{formError}</p>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={salvarTurma.isPending}>
              {salvarTurma.isPending ? "Salvando..." : editingTurma ? "Salvar" : "Criar turma"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Remover turma</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja remover a turma{" "}
              <strong>
                {deleteConfirm && buildTurmaCode(deleteConfirm.ano, deleteConfirm.sufixo)}
              </strong>
              {deleteConfirm && ` (${deleteConfirm.anoLetivo})`}? Essa ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
            >
              Remover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Share / QR Code Dialog */}
      <Dialog open={!!shareTurma} onOpenChange={() => setShareTurma(null)}>
        <DialogContent className="sm:max-w-sm text-center">
          <DialogHeader>
            <DialogTitle className="text-center">Código da Turma</DialogTitle>
            <DialogDescription className="text-center">
              Compartilhe este código ou QR Code para que os responsáveis possam entrar diretamente na{" "}
              <strong>{shareTurma && buildTurmaCode(shareTurma.ano, shareTurma.sufixo)}</strong>.
            </DialogDescription>
          </DialogHeader>

          {shareTurma && (
            <div className="flex flex-col items-center justify-center gap-6 py-4">
              <div className="rounded-xl border bg-white p-4 shadow-sm">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${shareTurma.codigoAcesso}`}
                  alt={`QR Code para ${shareTurma.codigoAcesso}`}
                  className="size-48"
                />
              </div>
              <div className="flex w-full flex-col gap-2">
                <Label className="text-muted-foreground">Código de Acesso</Label>
                <div className="flex w-full items-center gap-2">
                  <Input readOnly value={shareTurma.codigoAcesso} className="font-mono text-center text-lg tracking-widest" />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      navigator.clipboard.writeText(shareTurma.codigoAcesso);
                      toast.success("Código copiado!");
                    }}
                  >
                    <Copy className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="sm:justify-center">
            <Button variant="outline" onClick={() => setShareTurma(null)} className="w-full">
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
