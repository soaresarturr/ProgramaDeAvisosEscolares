// Edge Function (Deno): a administração cria e remove contas. A senha é fixa (não há redefinição).
//
// Quem chama: o próprio site, com o login de quem está usando (supabase.functions.invoke).
// Regras:
//   * só ADMIN, DIRETOR e DEV usam esta função;
//   * ADMIN e DIRETOR criam/editam/removem RESPONSAVEL e PROFESSOR; só DEV faz isso com ADMIN;
//   * DIRETOR só é editado/removido por ADMIN ou DEV;
//   * contas DEV e a própria conta não são editadas nem removidas por aqui.
// Editar o CPF muda o login; editar o primeiro nome ou o CPF gera a nova senha padrão.
// Login = CPF. Senha padrão = primeiro nome (minúsculo, sem acento) + CPF.
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já existem automaticamente nas Edge Functions.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Papel = "ADMIN" | "DEV" | "DIRETOR" | "PROFESSOR" | "RESPONSAVEL";

const PODE_CRIAR: Record<string, Papel[]> = {
  ADMIN: ["RESPONSAVEL", "PROFESSOR"],
  DIRETOR: ["RESPONSAVEL", "PROFESSOR"],
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

// "Nome completo": nome + sobrenome (2+ palavras com 2+ letras) e sem "-". Mesma regra do site.
function erroNomeCompleto(nome: string): string | null {
  if (/[-‐‑‒–—―]/.test(nome)) return 'O nome não pode ter "-".';
  const partes = nome.split(" ").filter(Boolean);
  if (partes.length < 2 || partes.some((p) => p.length < 2)) {
    return "Informe o nome completo do responsável.";
  }
  return null;
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
    return responder(
      { erro: `Erro ao conferir seu perfil (${erroPerfil.code ?? erroPerfil.message}).` },
      500,
    );
  }
  const papelChamador = chamador?.role as Papel | undefined;
  if (papelChamador !== "ADMIN" && papelChamador !== "DEV" && papelChamador !== "DIRETOR") {
    return responder(
      { erro: `Você não tem permissão para isso (seu perfil: ${papelChamador ?? "nenhum"}).` },
      403,
    );
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
    DIRETOR: "direção",
  };

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return responder({ erro: "Requisição inválida." }, 400);
  }

  if (body.acao === "criar") {
    const nome = String(body.nome ?? "")
      .trim()
      .replace(/\s+/g, " ");
    const cpf = String(body.cpf ?? "").replace(/\D/g, "");
    const papel = String(body.papel ?? "RESPONSAVEL") as Papel;

    const erroNome = erroNomeCompleto(nome);
    if (erroNome) return responder({ erro: erroNome }, 400);
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
      const duplicado =
        error?.code === "email_exists" || /already|exists|duplicate/i.test(error?.message ?? "");
      if (!duplicado) console.error("Erro ao criar usuário:", error);
      return duplicado
        ? responder({ erro: "Já existe um usuário com este CPF." }, 409)
        : responder({ erro: "Não foi possível criar o usuário." }, 500);
    }

    // Garante nome/CPF/papel no perfil mesmo que o gatilho do banco seja uma versão antiga
    // (que gravava o CPF no lugar do nome). Requer a migração 20261112000000.
    const { error: erroAjuste } = await admin
      .from("profiles")
      .update({ name: nome, username: cpf, cpf, role: papel })
      .eq("id", data.user.id);
    if (erroAjuste) {
      const { data: perfil } = await admin
        .from("profiles")
        .select("name, cpf, role")
        .eq("id", data.user.id)
        .single();
      if (perfil?.name !== nome || perfil?.cpf !== cpf || perfil?.role !== papel) {
        console.error("Perfil criado com dados errados e não consegui corrigir:", erroAjuste);
        await admin.auth.admin.deleteUser(data.user.id);
        return responder(
          { erro: "Não foi possível salvar o perfil. Rode a migração 20261112000000 no Supabase." },
          500,
        );
      }
    }

    await registrar("Usuário criado", `${nome} (${ROTULO[papel]})`);
    return responder({ userId: data.user.id, login: cpf, senha });
  }

  if (body.acao === "editar") {
    // Corrige erro de digitação no nome/CPF. Mesmas regras de quem pode remover.
    const userId = String(body.userId ?? "");
    const nome = String(body.nome ?? "")
      .trim()
      .replace(/\s+/g, " ");
    if (userId === auth.user.id)
      return responder({ erro: "Você não pode editar a própria conta por aqui." }, 400);
    const erroNome = erroNomeCompleto(nome);
    if (erroNome) return responder({ erro: erroNome }, 400);

    const { data: alvo } = await admin
      .from("profiles")
      .select("role, name, cpf")
      .eq("id", userId)
      .single();
    if (!alvo) return responder({ erro: "Usuário não encontrado." }, 404);
    if (alvo.role === "DEV")
      return responder({ erro: "Contas DEV não podem ser editadas por aqui." }, 403);
    if (alvo.role === "ADMIN" && papelChamador !== "DEV") {
      return responder({ erro: "Só o DEV edita administradores." }, 403);
    }
    if (alvo.role === "DIRETOR" && papelChamador === "DIRETOR") {
      return responder({ erro: "Só a administração edita a conta da direção." }, 403);
    }

    // Contas sem CPF (ex.: administração, direção) só trocam o nome; login e senha ficam iguais.
    const temCpf = !!alvo.cpf;
    const cpf = temCpf ? String(body.cpf ?? "").replace(/\D/g, "") : null;
    if (temCpf && !cpfValido(cpf!))
      return responder({ erro: "CPF inválido. Confira os números." }, 400);

    const mudouCpf = temCpf && cpf !== alvo.cpf;
    const mudouSenha = temCpf && senhaPadrao(nome, cpf!) !== senhaPadrao(alvo.name, alvo.cpf!);
    if (nome === alvo.name && !mudouCpf) return responder({ ok: true });

    // 1) Perfil (o banco recusa CPF repetido)
    const perfilNovo = temCpf ? { name: nome, cpf, username: cpf } : { name: nome };
    const { error: erroPerfilNovo } = await admin
      .from("profiles")
      .update(perfilNovo)
      .eq("id", userId);
    if (erroPerfilNovo) {
      if (erroPerfilNovo.code === "23505")
        return responder({ erro: "Já existe um usuário com este CPF." }, 409);
      console.error("Erro ao editar perfil:", erroPerfilNovo);
      return responder(
        { erro: "Não foi possível salvar. Rode a migração 20261112000000 no Supabase." },
        500,
      );
    }

    // 2) Conta de login: e-mail (= CPF), senha padrão e metadados
    const senha = mudouSenha ? senhaPadrao(nome, cpf!) : undefined;
    const { error: erroConta } = await admin.auth.admin.updateUserById(userId, {
      ...(mudouCpf ? { email: `${cpf}@escola.local`, email_confirm: true } : {}),
      ...(senha ? { password: senha } : {}),
      ...(temCpf ? { app_metadata: { name: nome, cpf, role: alvo.role } } : {}),
    });
    if (erroConta) {
      console.error("Erro ao editar conta:", erroConta);
      // Desfaz o perfil para não ficar diferente do login
      const perfilAntigo = temCpf
        ? { name: alvo.name, cpf: alvo.cpf, username: alvo.cpf }
        : { name: alvo.name };
      await admin.from("profiles").update(perfilAntigo).eq("id", userId);
      const duplicado = /already|exists|duplicate/i.test(erroConta.message ?? "");
      return duplicado
        ? responder({ erro: "Já existe um usuário com este CPF." }, 409)
        : responder({ erro: "Não foi possível salvar a conta." }, 500);
    }

    const mudancas = [
      nome !== alvo.name ? `nome: ${alvo.name} → ${nome}` : null,
      mudouCpf ? "CPF corrigido" : null,
    ].filter(Boolean);
    await registrar(
      "Usuário editado",
      `${nome} (${ROTULO[alvo.role as Papel] ?? alvo.role}) · ${mudancas.join(", ")}`,
    );
    return responder({ ok: true, ...(senha ? { login: cpf, senha } : {}) });
  }

  if (body.acao === "remover") {
    const userId = String(body.userId ?? "");
    if (userId === auth.user.id)
      return responder({ erro: "Você não pode remover a própria conta." }, 400);

    const { data: alvo } = await admin
      .from("profiles")
      .select("role, name")
      .eq("id", userId)
      .single();
    if (!alvo) return responder({ erro: "Usuário não encontrado." }, 404);
    if (alvo.role === "DEV")
      return responder({ erro: "Contas DEV não podem ser removidas por aqui." }, 403);
    if (alvo.role === "ADMIN" && papelChamador !== "DEV") {
      return responder({ erro: "Só o DEV remove administradores." }, 403);
    }
    if (alvo.role === "DIRETOR" && papelChamador === "DIRETOR") {
      return responder({ erro: "Só a administração remove a conta da direção." }, 403);
    }

    // O banco apaga em cascata: perfil → filhos → notificações → aparelhos de push
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) {
      console.error("Erro ao remover usuário:", error);
      return responder({ erro: "Não foi possível remover o usuário." }, 500);
    }
    await registrar(
      "Usuário removido",
      `${alvo.name} (${ROTULO[alvo.role as Papel] ?? alvo.role})`,
    );
    return responder({ ok: true });
  }

  return responder({ erro: "Ação desconhecida." }, 400);
});
