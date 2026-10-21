# Quantização na biblioteca

A biblioteca pode reduzir um modelo que já está no disco e salvar o resultado como outro modelo. O arquivo original permanece. A escolha abaixo usa as medições publicadas com as versões que o aplicativo já embute: llama.cpp `b10809` e, no Mac com Apple Silicon, MLX LM `0.31.3`.

## O que entra em cada formato

Um GGUF em F16 ou BF16 ocupa cerca de 16 bits por peso. Q8_0 fica em 8,50 bits e é quase sem perda. A tabela medida do Llama 3.1 8B no llama.cpp `b10809` registra, em bits por peso: Q6_K 6,56, Q5_K_M 5,70, Q4_K_M 4,89, Q4_K_S 4,67, IQ4_XS 4,46 e Q3_K_M 4,00. O tamanho de saída previsto no aplicativo é o tamanho da origem multiplicado pela razão desses valores.

No MLX, 4 bits com grupo 64 guardam escala e viés e ficam em cerca de 4,5 bits por peso. Grupo 128 fica em cerca de 4,25. O modo misto `mixed_4_6`, presente no conversor 0.31.3, mantém camadas sensíveis em 6 bits e o restante em 4, em torno de 4,9 bits por peso.

## Comparação

| Abordagem | Qualidade por bit | Velocidade | RAM na conversão | Licença | Onde roda |
|---|---|---|---|---|---|
| llama.cpp `llama-quantize`, K-quants (Q4_K_M, Q5_K_M, Q6_K) | Q4_K_M é o equilíbrio usado pelo próprio catálogo. Q6_K chega perto de Q8_0 com bem menos disco. | Caminho rápido do llama.cpp, em CPU e em Metal. | O quantizador carrega o modelo inteiro. A RAM de trabalho acompanha o tamanho da origem, com 1 GiB de folga. | MIT | Mac, Windows e Linux, no mesmo pacote do `llama-server`. |
| llama.cpp I-quants (IQ4_XS) com imatrix | Menor que Q4_K_M. A matriz de importância recupera qualidade sobretudo abaixo de 5 bits. | Mais cálculo por token. Nos pacotes de CPU do Windows e do Linux a geração fica mais lenta que a dos K-quants. | A calibração também carrega o modelo. A folga usada é o tamanho × 1,25 + 1 GiB. | MIT | Os três sistemas, desde que `llama-imatrix` esteja ao lado do servidor. |
| MLX `mlx_lm.convert -q` | 4 bits, grupo 64, é o padrão da comunidade MLX. O misto 4/6 preserva mais as camadas sensíveis. | Inferência no Apple Silicon, pelo MLX já embutido. | Soma dos pesos de origem, da saída e de 1 GiB. | MIT (MLX e MLX LM) | Só o pacote Mac Apple Silicon. |
| AWQ, GPTQ, bitsandbytes NF4, HQQ, EXL2, torchao, OpenVINO, AMD Quark | Bons em GPU NVIDIA, Intel ou AMD, cada um no seu runtime. | Dependem de CUDA, PyTorch ou de outro motor. | Variável; vários exigem a máquina de treino. | MIT, Apache-2.0 ou BSD-3, conforme o projeto | Não alimentam o llama.cpp nem o MLX embutidos. |

Unsloth e outras publicações de GGUF dinâmico continuam sendo llama.cpp com imatrix. O aplicativo gera a matriz neste computador, com a amostra local, e não baixa um GGUF já quantizado por terceiros.

## Padrão por plataforma

**Windows, Linux e GGUF no Mac:** `Q4_K_M` com imatrix. É o preset Equilibrado. Q4_K_M mede 4,89 bits por peso na tabela do Llama 3.1 8B, cabe no motor embutido e é a quantização preferida do catálogo. IQ4_XS fica reservado ao preset Menor tamanho: o arquivo é menor, e a imatrix importa mais, com geração mais lenta na CPU. Q6_K é o preset Máxima qualidade; a diferença publicada de perplexidade para um modelo de 8B é pequena diante de Q8_0, e o arquivo continua bem menor que o Q8_0. A imatrix deixa de ser calculada quando a RAM livre não comporta a calibração, e o detalhe passa a `GGUF Q4_K_M · sem imatrix`.

**MLX no Mac com Apple Silicon:** 4 bits, grupo 64. É o formato que o MLX LM 0.31.3 produz com `-q` e o que a comunidade publica para inferência. Menor tamanho usa grupo 128. Máxima qualidade usa `--quant-predicate mixed_4_6`. O quantizador dinâmico mais novo (`mlx_lm.dynamic_quant`) não está na roda 0.31.3 e esta versão não o chama.

## Como o quantizador chega ao aplicativo

`scripts/fetch-runtime.py` baixa, na compilação do pacote, o arquivo oficial do llama.cpp `b10809` já fixado em `runtime/manifest.json`. Confere o tamanho e o SHA-256 e extrai o arquivo inteiro. `llama-quantize` e `llama-imatrix` vêm nesse arquivo, ao lado de `llama-server`. O empacotamento copia a pasta do runtime, então os dois executáveis seguem com o aplicativo. Abrir o LocalNeuron não baixa outro runtime.

No Mac, a quantização MLX usa o Python portátil 3.12.14, o MLX 0.32.2 e o MLX LM 0.31.3 de `runtime/mlx-manifest.json`, montados por `scripts/fetch-mlx.py` na compilação. Nenhum Python instalado no sistema é chamado. No Windows e no Linux a opção MLX explica que o pacote não a inclui.

A calibração da imatrix lê `runtime/quantize-calibration.txt`, um texto curto em português e inglês copiado para o pacote junto com o runtime. Não há download de corpus.

## O que a tela faz

Na área Modelos, cada GGUF ou pasta MLX instalada tem **Quantizar**. Os presets aparecem como Equilibrado (recomendado), Menor tamanho e Máxima qualidade. O formato exato fica no detalhe: `GGUF Q4_K_M · imatrix`, `GGUF IQ4_XS · imatrix`, `GGUF Q6_K`, `MLX 4 bits · grupo 64`, `MLX 4 bits · grupo 128` ou `MLX misto 4 e 6 bits`. Antes de começar, a tela mostra o tamanho previsto e a RAM para usar o resultado. A RAM de uso segue a mesma conta do carregamento: GGUF × 1,25 + 1 GiB; MLX × 1 + 0,5 GiB.

O progresso, o cancelamento e o erro ficam na janela e na lista. O resultado entra em `models/quantized/` e aparece na lista; o original continua no lugar.

## Limites

- A origem GGUF aceita é F16, BF16, F32 ou Q8_0, num único arquivo. Q4, Q5, Q6 e I-quants já comprimidos ficam de fora: o próprio llama.cpp avisa que requantizar esses tipos perde qualidade. Q8_0 ainda pode ser requantizado, com resultado abaixo de partir de 16 bits.
- GGUF dividido em partes, projetor `mmproj` e arquivo fora da pasta de modelos do aplicativo, inclusive um GGUF só enxergado na pasta do LM Studio, não entram.
- Pasta MLX já quantizada, ou com quantização por camada, também fica de fora. GGUF não é convertido em MLX.
- Se a RAM ou o disco, com 1 GiB de margem, não comportam a operação, ela não começa. A mesma conta é refeita imediatamente antes de cada etapa, porque a memória livre pode cair durante a calibração.
- Há uma quantização por vez. O processo recebe um vetor de argumentos, sem shell. Os caminhos são resolvidos e precisam permanecer dentro da pasta de modelos. A amostra e os pesos não saem pela rede: o MLX herda `HF_HUB_OFFLINE` e, no Mac, o mesmo perfil que nega saída de rede da inferência.
