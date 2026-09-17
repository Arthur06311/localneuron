# Conectar um domínio da Name.com

O site do LocalNeuron está no GitHub Pages. Para usar seu próprio endereço, configure o domínio no GitHub e depois os registros DNS. É necessário saber o domínio completo, como `seu-dominio.com`; Name.com é o nome da empresa onde ele foi comprado.

## 1. Cadastrar no GitHub

Abra [Settings → Pages do LocalNeuron](https://github.com/Arthur06311/localneuron/settings/pages). Em **Custom domain**, informe o domínio completo, sem `https://` e sem caminhos, e salve. Faça isso antes de apontar o DNS.

## 2. Apontar na Name.com

Entre em **My Domains → seu domínio → Manage DNS Records**. Se o domínio usa os nameservers da Name.com, adicione os registros abaixo. Se o DNS estiver delegado a outro provedor, a alteração deve ser feita nesse outro painel.

| Type | Host | Answer |
|---|---|---|
| A | vazio | `185.199.108.153` |
| A | vazio | `185.199.109.153` |
| A | vazio | `185.199.110.153` |
| A | vazio | `185.199.111.153` |
| CNAME | `www` | `arthur06311.github.io` |

Pode manter o TTL padrão de 300. Na Name.com, Host vazio representa o domínio principal. O CNAME usa `www`, não deve ficar vazio. Não acrescente `https://` nem `/localneuron` ao Answer. Confira apontamentos anteriores conflitantes; preserve MX e TXT de e-mail e outros serviços. Não crie um apontamento curinga `*` para o GitHub Pages.

## 3. Ativar HTTPS

Volte ao GitHub Pages, aguarde a validação e ative **Enforce HTTPS** quando disponível. A propagação DNS e a disponibilidade do certificado podem levar até 24 horas. Depois, confira o endereço principal, `www`, a página do guia e os downloads.

## Para quem mantém o código

O domínio confirmado deve estar também em `website/CNAME`, preservado ao publicar a pasta em `gh-pages`. A configuração feita pelo painel do GitHub pode criar um commit nessa branch; integre esse commit antes de reenviar o site, sem sobrescrever a configuração do domínio. Atualize a verificação de arquivos estáticos para admitir o CNAME real. Não crie um arquivo CNAME com exemplo ou domínio ainda não confirmado.

A partir da 0.27, o app consulta versões em `raw.githubusercontent.com/Arthur06311/localneuron/gh-pages/releases.json`. Esse endereço continua independente do domínio personalizado. Os instaladores permanecem nos assets de GitHub Releases.

Fontes: [Name.com — registro A](https://www.name.com/support/articles/205188538-pointing-your-domain-to-hosting-with-a-records), [Name.com — CNAME](https://www.name.com/support/articles/115004895548-adding-a-cname-record), [GitHub — domínio personalizado](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site).
