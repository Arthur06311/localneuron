# Contribuir com o LocalNeuron

Antes de propor uma alteração, confira o README, as limitações da alfa e o estado da licença do código próprio.

## Reportar problemas

Inclua versão do app, sistema/arquitetura, modelo/motor, passos para reproduzir, resultado esperado e mensagem de erro. Remova chaves, tokens, e-mails pessoais, prompts privados e caminhos de usuário. Não anexe sua pasta de dados.

## Desenvolvimento

Use Node.js 24+, `npm ci` e `npm test`. Para a ponte do Editor, execute `python3 tests/resolve_bridge_test.py`. Alterações no guia exigem `node scripts/build-website.mjs` e `node --test tests/website.test.mjs`.

Mantenha os dados locais retrocompatíveis. Não substitua inferência real por resultados simulados na interface. Diferencie claramente fixture de teste, download de pesos e motor realmente integrado. Evite adicionar telemetria ou chamadas externas sem controle do usuário.

Em um pull request, descreva o problema, o comportamento final, os testes executados e limitações conhecidas. Novos motores/modelos precisam de origem, versão, licença e hashes verificáveis quando aplicável.
