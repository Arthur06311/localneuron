# Contribuir com o LocalNeuron

Antes de propor uma alteração, confira o README, as limitações da alfa e a licença proprietária em [LICENSE](LICENSE). Não há permissão de cópia, modificação nem redistribuição do código próprio sem autorização escrita do titular.

## Reportar problemas

Use o formulário [🐞 Relatar um bug](https://github.com/Arthur06311/localneuron/issues/new?template=bug_report.yml). Inclua versão do app, sistema/arquitetura, modelo/motor, passos para reproduzir, resultado esperado e mensagem de erro. Remova chaves, tokens, e-mails pessoais, prompts privados e caminhos de usuário. Não anexe sua pasta de dados. Vulnerabilidades de segurança não devem ser relatadas em issues abertas; use o canal privado descrito no [SECURITY.md](SECURITY.md).

## Desenvolvimento

Use Node.js 24+, `npm ci` e `npm test`. Para a ponte do Editor, execute `python3 tests/resolve_bridge_test.py`. Alterações no guia exigem `node scripts/build-website.mjs` e `node --test tests/website.test.mjs`.

Mantenha os dados locais retrocompatíveis. Não substitua inferência real por resultados simulados na interface. Diferencie claramente fixture de teste, download de pesos e motor realmente integrado. Evite adicionar telemetria ou chamadas externas sem controle do usuário.

Pull requests só são aceitos de quem tiver autorização escrita do titular. As contribuições aceitas passam a fazer parte do código proprietário. No pull request, descreva o problema, o comportamento final, os testes executados e as limitações conhecidas. Novos motores/modelos precisam de origem, versão, licença e hashes verificáveis quando aplicável.
