# Segurança

LocalNeuron está em alfa. O painel local requer sessão e deve permanecer em loopback. Minha API e EXO devem operar somente em rede privada confiável ou VPN, conforme seus guias.

Não publique vulnerabilidades acompanhadas de credenciais, dados pessoais, prompts privados ou arquivos de usuários em issues abertos. Use o canal **Report a vulnerability** da aba Security quando disponível. Se não estiver habilitado, abra apenas um pedido genérico de contato privado, sem detalhes exploráveis ou conteúdo sensível.

A senha cifra os segredos do cofre, não todo o conteúdo do espaço. Preserve controle de acesso e proteção do disco no sistema operacional. Instalações de motores opcionais executam dependências de seus respectivos projetos; consulte manifests e avisos de terceiros.

O repositório público não deve conter `.env`, chaves privadas, cofre, sessões, ativações Pro, dados de conversas ou modelos baixados. Testes usam fixtures sintéticas e chaves geradas durante a execução.
