import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  CalendarCheck,
  ChevronDown,
  GraduationCap,
  LogOut,
  Megaphone,
  Menu,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const cadastros = [
  { label: "Alunos", to: "/alunos" },
  { label: "Responsáveis", to: "/responsaveis" },
  { label: "Turmas", to: "/turmas" },
] as const;

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const cadastrosActive = cadastros.some((item) => item.to === pathname);
  const [open, setOpen] = useState(cadastrosActive);

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
    </nav>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

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
                  <NavLinks onNavigate={() => setMobileOpen(false)} />
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
                <p className="text-xs text-muted-foreground">Administração</p>
              </div>
            </Link>
          </div>

          <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
            <Link to="/">
              <LogOut className="size-4" />
              Sair
            </Link>
          </Button>
        </div>
      </header>

      <div className="flex">
        <aside className="hidden w-60 shrink-0 border-r bg-card px-3 py-6 lg:block">
          <NavLinks />
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
