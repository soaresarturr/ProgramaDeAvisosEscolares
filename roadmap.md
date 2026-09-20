# Roadmap — Portal Escolar

## Regra permanente de design (vale para TODAS as telas)

Contexto de uso: **não é um SaaS institucional grande** — é uma ferramenta de apoio para os
professoras/secretaria de **uma única escola**. Facilidade de uso é a prioridade máxima, acima de
aparecer impressionante: telas com excesso de informação, campos, filtros ou opções deixam perdidas.

1. **Essencial na tela, avançado a um clique.** O que é raro ou opcional fica escondido atrás
   de "mais opções", modais ou expansores — nunca sempre visível.
2. **Poucos campos, linguagem simples.** Menos campos por tela, termos do dia a dia da escola,
   zero jargão técnico.
3. **Um botão de destaque por tela.** Ações principais claras; sem vários botões competindo
   pela atenção.
4. **Tabelas enxutas.** Só as colunas mais importantes por padrão; as demais atrás de
   "mostrar mais colunas".
5. **Fluxos guiados.** Preferir passo a passo (wizard) em vez de formulário longo de uma vez.
6. **Nada decorativo ou de marketing.** Sem fotos de apoio, painéis laterais ilustrados, frases de
   venda ou listas de benefícios. O azul aparece de forma discreta (botões e detalhes), não em
   gradientes grandes ocupando a tela.

Ao revisar qualquer tela existente, aplicar estas mesmas regras (simplificar, não adicionar).

## Telas

- [x] Tela de login (card central pequeno: nome do sistema, e-mail, senha, "Entrar"; sem foto,
      sem marketing, sem "esqueci minha senha" / "manter-me conectado")
- [x] Dashboard administrativo (3 números essenciais, últimos 3 comunicados e um único CTA)
- [ ] Alunos
- [ ] Responsáveis
- [ ] Turmas
- [ ] Matrículas / anos letivos
- [ ] Comunicados (novo + histórico + leitura)
- [ ] Passagem de ano
- [ ] Banco de dados completo e autenticação real por perfil
