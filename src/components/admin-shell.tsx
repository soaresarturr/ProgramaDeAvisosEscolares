import { useState } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { MOCK_DB, useAuth } from "@/contexts/auth";
import {
  Bell,
  CalendarCheck,
  ClipboardCheck,
  ChevronDown,
  GraduationCap,
  LogOut,
  Megaphone,
  Menu,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const cadastros = [
  { label: "Alunos", to: "/alunos" },
  { label: "Responsáveis", to: "/responsaveis" },
  { label: "Turmas", to: "/turmas" },
] as const;

function NavLinks({ onNavigate, role }: { onNavigate?: () => void; role?: string }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const canManage = role === "ADMIN" || role === "DEV" || role === "PROFESSOR";
  const cadastrosActive = cadastros.some((item) => item.to === pathname);
  const [open, setOpen] = useState(cadastrosActive);
  const pendentes = MOCK_DB.users.filter((u) => u.requestedProfessor).length;

  const itemClass = (active: boolean) =>
    `flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors ${
      active
        ? "bg-accent font-medium text-primary"
        : "text-foreground hover:bg-accent/60"
    }`;

  return (
    <nav className="flex flex-col gap-1">
      <Link to="/comunicados" onClick={onNavigate} className={itemClass(pathname === "/comunicados")}>
        <Megaphone className="size-4 shrink-0" />
        Comunicados
      </Link>

      {canManage && (
        <>
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className={itemClass(cadastrosActive && !open)}
          >
            <Users className="size-4 shrink-0" />
            Cadastros
            <ChevronDown
              className={`ml-auto size-4 shrink-0 text-muted-foreground transition-transform ${
                open ? "rotate-180" : ""
              }`}
            />
          </button>

          {open && (
            <div className="ml-7 flex flex-col gap-1 border-l pl-2">
              {cadastros.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={onNavigate}
                  className={`rounded-md px-3 py-2 text-sm transition-colors ${
                    pathname === item.to
                      ? "bg-accent font-medium text-primary"
                      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          )}

          <Link to="/ano-letivo" onClick={onNavigate} className={itemClass(pathname === "/ano-letivo")}>
            <CalendarCheck className="size-4 shrink-0" />
            Ano Letivo
          </Link>

          {(role === "ADMIN" || role === "DEV") && (
            <Link to="/solicitacoes" onClick={onNavigate} className={itemClass(pathname === "/solicitacoes")}>
              <ClipboardCheck className="size-4 shrink-0" />
              Solicitações
              {pendentes > 0 && (
                <span className="ml-auto rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                  {pendentes}
                </span>
              )}
            </Link>
          )}
        </>
      )}
    </nav>
  );
}

function NotificationsBell() {
  const { notificacoes, marcarNotificacoesLidas } = useAuth();
  const naoLidas = notificacoes.filter((n) => !n.lida).length;
  const [permissao, setPermissao] = useState<string>(
    typeof Notification === "undefined" ? "unsupported" : Notification.permission,
  );

  const ativarAvisos = async () => setPermissao(await Notification.requestPermission());

  return (
    <Popover onOpenChange={(aberto) => !aberto && marcarNotificacoesLidas()}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notificações">
          <Bell className="size-5" />
          {naoLidas > 0 && (
            <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
              {naoLidas}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0">
        <div className="max-h-72 divide-y overflow-y-auto">
          {notificacoes.length === 0 && (
            <p className="p-4 text-center text-sm text-muted-foreground">Nada de novo por aqui.</p>
          )}
          {notificacoes.map((n) => (
            <Link key={n.id} to="/comunicados" className="block px-4 py-3 text-sm hover:bg-accent/60">
              <span className={n.lida ? "text-muted-foreground" : "font-medium text-foreground"}>
                {n.titulo}
              </span>
            </Link>
          ))}
        </div>
        {permissao === "default" && (
          <button
            type="button"
            onClick={ativarAvisos}
            className="w-full border-t px-4 py-3 text-left text-xs text-primary hover:bg-accent/60"
          >
            Receber avisos também no navegador
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate({ to: "/login" });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b bg-card">
        <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menu">
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-5">
                <SheetTitle className="font-display text-base">Menu</SheetTitle>
                <div className="mt-5">
                  <NavLinks onNavigate={() => setMobileOpen(false)} role={user?.role} />
                </div>
              </SheetContent>
            </Sheet>

            <Link to="/dashboard" className="flex min-w-0 items-center gap-3 rounded-md">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <GraduationCap className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="truncate font-display text-sm font-semibold text-foreground sm:text-base">
                  Portal Escolar
                </p>
                <p className="text-xs text-muted-foreground">
                  {user?.role === "RESPONSAVEL" ? "Área do Responsável" : "Administração"}
                </p>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-1">
            {user?.role === "RESPONSAVEL" && <NotificationsBell />}
            <Button variant="ghost" size="sm" className="text-muted-foreground gap-2" onClick={handleLogout}>
              <LogOut className="size-4" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <div className="flex">
        <aside className="hidden w-60 shrink-0 border-r bg-card px-3 py-6 lg:block">
          <NavLinks role={user?.role} />
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
