import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/* ── Séries da escola ─────────────────────────────────────────── */

export interface Serie {
  value: string;
  label: string;
  order: number;
}

export const SERIES: Serie[] = [
  { value: "J1", label: "Jardim 1", order: 0 },
  { value: "J2", label: "Jardim 2", order: 1 },
  { value: "1", label: "1º Ano", order: 2 },
  { value: "2", label: "2º Ano", order: 3 },
];

export function getSerieLabel(value: string): string {
  return SERIES.find((s) => s.value === value)?.label ?? value;
}

export function getSerieOrder(value: string): number {
  return SERIES.find((s) => s.value === value)?.order ?? 99;
}

/* ── Turma model ──────────────────────────────────────────────── */

export interface Turma {
  id: string;
  /** Serie code: "J1", "J2", "1", "2" */
  serie: string;
  /** Suffix that identifies the class within the serie, e.g. "A", "B" */
  sufixo: string;
  /** Number of enrolled students (mock) */
  totalAlunos: number;
}

/** Display name, e.g. "J1A" or "2B" */
export function buildTurmaCode(serie: string, sufixo: string): string {
  return `${serie}${sufixo}`;
}

/** Full display label, e.g. "Jardim 1 — Turma A" */
export function buildTurmaLabel(serie: string, sufixo: string): string {
  return `${getSerieLabel(serie)} — Turma ${sufixo}`;
}

const INITIAL_TURMAS: Turma[] = [
  { id: "1", serie: "J1", sufixo: "A", totalAlunos: 18 },
  { id: "2", serie: "J1", sufixo: "B", totalAlunos: 16 },
  { id: "3", serie: "J2", sufixo: "A", totalAlunos: 20 },
  { id: "4", serie: "1", sufixo: "A", totalAlunos: 22 },
  { id: "5", serie: "1", sufixo: "B", totalAlunos: 21 },
  { id: "6", serie: "2", sufixo: "A", totalAlunos: 19 },
];

/* ── Route ────────────────────────────────────────────────────── */

export const Route = createFileRoute("/turmas")({
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
  const [turmas, setTurmas] = useState<Turma[]>(INITIAL_TURMAS);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTurma, setEditingTurma] = useState<Turma | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Turma | null>(null);

  // Form state
  const [formSerie, setFormSerie] = useState<string>("");
  const [formSufixo, setFormSufixo] = useState("");
  const [formError, setFormError] = useState("");

  function openCreate() {
    setEditingTurma(null);
    setFormSerie("");
    setFormSufixo("");
    setFormError("");
    setDialogOpen(true);
  }

  function openEdit(turma: Turma) {
    setEditingTurma(turma);
    setFormSerie(turma.serie);
    setFormSufixo(turma.sufixo);
    setFormError("");
    setDialogOpen(true);
  }

  function validate(serie: string, sufixo: string, excludeId?: string): string | null {
    if (!serie) return "Selecione a série.";
    if (!sufixo.trim()) return "Informe o sufixo da turma (ex: A, B).";

    const code = buildTurmaCode(serie, sufixo.trim().toUpperCase());
    const duplicate = turmas.find(
      (t) => buildTurmaCode(t.serie, t.sufixo) === code && t.id !== excludeId,
    );
    if (duplicate) return `A turma "${code}" já existe.`;

    return null;
  }

  function handleSave() {
    const error = validate(formSerie, formSufixo, editingTurma?.id);
    if (error) {
      setFormError(error);
      return;
    }

    const serie = formSerie;
    const sufixo = formSufixo.trim().toUpperCase();

    if (editingTurma) {
      setTurmas((prev) =>
        prev.map((t) => (t.id === editingTurma.id ? { ...t, serie, sufixo } : t)),
      );
      toast.success(`Turma "${buildTurmaCode(serie, sufixo)}" atualizada.`);
    } else {
      const newTurma: Turma = {
        id: crypto.randomUUID(),
        serie,
        sufixo,
        totalAlunos: 0,
      };
      setTurmas((prev) => [...prev, newTurma]);
      toast.success(`Turma "${buildTurmaCode(serie, sufixo)}" criada.`);
    }

    setDialogOpen(false);
  }

  function handleDelete(turma: Turma) {
    setTurmas((prev) => prev.filter((t) => t.id !== turma.id));
    setDeleteConfirm(null);
    toast.success(`Turma "${buildTurmaCode(turma.serie, turma.sufixo)}" removida.`);
  }

  // Sort turmas by serie order, then suffix
  const sorted = turmas
    .slice()
    .sort((a, b) => getSerieOrder(a.serie) - getSerieOrder(b.serie) || a.sufixo.localeCompare(b.sufixo));

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
            size="lg"
            className="h-11 w-full sm:w-auto"
            onClick={openCreate}
          >
            <Plus className="size-4" />
            Adicionar turma
          </Button>
        </div>

        {sorted.length === 0 ? (
          <div className="mt-12 text-center">
            <p className="text-sm text-muted-foreground">Nenhuma turma cadastrada ainda.</p>
            <Button variant="outline" className="mt-4" onClick={openCreate}>
              <Plus className="size-4" />
              Criar primeira turma
            </Button>
          </div>
        ) : (
          <div className="mt-6 divide-y border-y">
            {sorted.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-4 py-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {buildTurmaLabel(t.serie, t.sufixo)}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t.totalAlunos} {t.totalAlunos === 1 ? "aluno" : "alunos"}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground hover:text-foreground"
                    aria-label={`Editar turma ${buildTurmaCode(t.serie, t.sufixo)}`}
                    onClick={() => openEdit(t)}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground hover:text-destructive"
                    aria-label={`Remover turma ${buildTurmaCode(t.serie, t.sufixo)}`}
                    onClick={() => setDeleteConfirm(t)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingTurma ? "Editar turma" : "Nova turma"}</DialogTitle>
            <DialogDescription>
              Escolha a série e o sufixo que identifica a turma (A, B, C…).
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="turma-serie">Série</Label>
              <Select
                value={formSerie}
                onValueChange={(v) => {
                  setFormSerie(v);
                  setFormError("");
                }}
              >
                <SelectTrigger id="turma-serie">
                  <SelectValue placeholder="Selecione a série" />
                </SelectTrigger>
                <SelectContent>
                  {SERIES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="turma-sufixo">Sufixo da turma</Label>
              <Input
                id="turma-sufixo"
                placeholder="Ex: A, B, C…"
                value={formSufixo}
                maxLength={10}
                onChange={(e) => {
                  setFormSufixo(e.target.value.toUpperCase());
                  setFormError("");
                }}
              />
              {formSerie && formSufixo.trim() && (
                <p className="text-xs text-muted-foreground">
                  Resultado:{" "}
                  <strong>
                    {buildTurmaLabel(formSerie, formSufixo.trim().toUpperCase())}
                  </strong>
                </p>
              )}
            </div>

            {formError && <p className="text-sm text-destructive">{formError}</p>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>{editingTurma ? "Salvar" : "Criar turma"}</Button>
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
                {deleteConfirm && buildTurmaLabel(deleteConfirm.serie, deleteConfirm.sufixo)}
              </strong>
              ? Essa ação não pode ser desfeita.
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
    </AdminShell>
  );
}
