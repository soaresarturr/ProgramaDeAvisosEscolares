import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Aplica a máscara de CPF enquanto a pessoa digita: 000.000.000-00 */
export function formatCpf(value: string) {
  const d = value.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
}

/** Hífen e traços parecidos (–, —): não são aceitos no nome. */
const TRACO = /[-‐‑‒–—―]/;

/** Tira os traços enquanto a pessoa digita no campo de nome. */
export function semTracos(value: string) {
  return value.replace(new RegExp(TRACO.source, "g"), "");
}

/**
 * Regra do "Nome completo": nome + sobrenome (pelo menos 2 palavras com 2 letras ou mais)
 * e sem "-". Devolve a mensagem de erro, ou null se estiver certo.
 * (A Edge Function gerenciar-usuarios confere a mesma regra.)
 */
export function erroNomeCompleto(value: string): string | null {
  if (TRACO.test(value)) return 'O nome não pode ter "-".';
  const partes = value.trim().split(/\s+/).filter(Boolean);
  if (partes.length < 2 || partes.some((p) => p.length < 2)) {
    return "Informe o nome completo: nome e sobrenome.";
  }
  return null;
}

/** Confere os dígitos verificadores do CPF (aceita com ou sem pontuação). */
export function isCpfValido(value: string) {
  const cpf = value.replace(/\D/g, "");
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const digito = (base: string) => {
    const soma = [...base].reduce((s, n, i) => s + Number(n) * (base.length + 1 - i), 0);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return digito(cpf.slice(0, 9)) === Number(cpf[9]) && digito(cpf.slice(0, 10)) === Number(cpf[10]);
}
