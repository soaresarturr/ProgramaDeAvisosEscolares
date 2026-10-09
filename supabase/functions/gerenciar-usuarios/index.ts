// Edge Function (Deno): a administração cria e remove contas. A senha é fixa (não há redefinição).
//
// Quem chama: o próprio site, com o login de quem está usando (supabase.functions.invoke).
// Regras:
//   * só ADMIN e DEV usam esta função;
//   * ADMIN cria/remove RESPONSAVEL e PROFESSOR; só DEV cria/remove ADMIN;
//   * contas DEV e a própria conta não são removidas por aqui.
// Login = CPF. Senha padrão = primeiro nome (minúsculo, sem acento) + CPF.
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já existem automaticamente nas Edge Functions.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Papel = "ADMIN" | "DEV" | "PROFESSOR" | "RESPONSAVEL";

const PODE_CRIAR: Record<string, Papel[]> = {
  ADMIN: ["RESPONSAVEL", "PROFESSOR"],
  DEV: ["RESPONSAVEL", "PROFESSOR", "ADMIN"],
};

function responder(body: unknown, status = 200) {
  return Response.json(body, { status, headers: CORS });
}

function cpfValido(cpf: string) {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const digito = (base: string) => {
    const soma = [...base].reduce((s, n, i) => s + Number(n) * (base.length + 1 - i), 0);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return digito(cpf.slice(0, 9)) === Number(cpf[9]) && digito(cpf.slice(0, 10)) === Number(cpf[10]);
}

function senhaPadrao(nome: string, cpf: string) {
  const primeiro = (nome.trim().split(/\s+/)[0] ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  return primeiro + cpf;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Quem está chamando? (token do login de quem usa o site)
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const { data: auth } = await admin.auth.getUser(token);
  if (!auth?.user) return responder({ erro: "Faça login novamente." }, 401);

  const { data: chamador, error: erroPerfil } = await admin
    .from("profiles")
    .select("role, name")
    .eq("id", auth.user.id)
    .single();
  if (erroPerfil) {
    // Normalmente: falta "grant select on public.profiles to service_role" (migração 20261009120000)
    console.error("Não consegui ler o perfil de quem chamou:", erroPerfil);
    return responder({ erro: `Erro ao conferir seu perfil (${erroPerfil.code ?? erroPerfil.message}).` }, 500);
  }
  const papelChamador = chamador?.role as Papel | undefined;
  if (papelChamador !== "ADMIN" && papelChamador !== "DEV") {
    return responder({ erro: `Você não tem permissão para isso (seu perfil: ${papelChamador ?? "nenhum"}).` }, 403);
  }

  // Registro no log da administração (falha no log não impede a ação)
  const registrar = async (acao: string, detalhes: string) => {
    const { error } = await admin
      .from("logs")
      .insert({ ator_id: auth.user!.id, ator_nome: chamador?.name ?? null, acao, detalhes });
    if (error) console.error("Erro ao gravar log:", error);
  };

  const ROTULO: Record<Papel, string> = {
    RESPONSAVEL: "responsável",
    PROFESSOR: "professor(a)",
    ADMIN: "administração",
    DEV: "desenvolvedor",
  };

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return responder({ erro: "Requisição inválida." }, 400);
  }

  if (body.acao === "criar") {
    const nome = String(body.nome ?? "").trim().replace(/\s+/g, " ");
    const cpf = String(body.cpf ?? "").replace(/\D/g, "");
    const papel = String(body.papel ?? "RESPONSAVEL") as Papel;

    if (nome.length < 2) return responder({ erro: "Informe o nome completo." }, 400);
    if (!cpfValido(cpf)) return responder({ erro: "CPF inválido. Confira os números." }, 400);
    if (!PODE_CRIAR[papelChamador]?.includes(papel)) {
      return responder({ erro: "Você não tem permissão para criar esse tipo de usuário." }, 403);
    }

    const senha = senhaPadrao(nome, cpf);
    const { data, error } = await admin.auth.admin.createUser({
      email: `${cpf}@escola.local`,
      password: senha,
      email_confirm: true,
      app_metadata: { name: nome, cpf, role: papel },
    });
    if (error || !data.user) {
      const duplicado = error?.code === "email_exists" || /already|exists|duplicate/i.test(error?.message ?? "");
      if (!duplicado) console.error("Erro ao criar usuário:", error);
      return duplicado
        ? responder({ erro: "Já existe um usuário com este CPF." }, 409)
        : responder({ erro: "Não foi possível criar o usuário." }, 500);
    }
    await registrar("Usuário criado", `${nome} (${ROTULO[papel]})`);
    return responder({ userId: data.user.id, login: cpf, senha });
  }

  if (body.acao === "remover") {
    const userId = String(body.userId ?? "");
    if (userId === auth.user.id) return responder({ erro: "Você não pode remover a própria conta." }, 400);

    const { data: alvo } = await admin.from("profiles").select("role, name").eq("id", userId).single();
    if (!alvo) return responder({ erro: "Usuário não encontrado." }, 404);
    if (alvo.role === "DEV") return responder({ erro: "Contas DEV não podem ser removidas por aqui." }, 403);
    if (alvo.role === "ADMIN" && papelChamador !== "DEV") {
      return responder({ erro: "Só o DEV remove administradores." }, 403);
    }

    // O banco apaga em cascata: perfil → filhos → notificações → aparelhos de push
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) {
      console.error("Erro ao remover usuário:", error);
      return responder({ erro: "Não foi possível remover o usuário." }, 500);
    }
    await registrar("Usuário removido", `${alvo.name} (${ROTULO[alvo.role as Papel] ?? alvo.role})`);
    return responder({ ok: true });
  }

  return responder({ erro: "Ação desconhecida." }, 400);
});
