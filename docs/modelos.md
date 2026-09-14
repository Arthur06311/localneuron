# Biblioteca de modelos — Alfa 0.5

229 modelos de texto selecionados, com versão e SHA-256 fixos. Há modelos de pesos abertos sob licenças diferentes; não se afirma que todo modelo seja open source no mesmo sentido. ChatGPT é um serviço online; gpt-oss é a opção da OpenAI para execução local.

## Catálogo

RAM abaixo é estimativa para contexto curto, não requisito oficial nem medição. GB = 10⁹ bytes; GiB = 1.024³ bytes. GPU, motor, contexto e aplicativos abertos mudam o consumo. O filtro Para este PC compara a RAM total com a sugestão de porte, sem garantir a carga.

| Modelo | Uso sugerido | Download GB | RAM estimada GiB | PC sugerido GiB | Licença declarada |
|---|---|---:|---:|---:|---|
| [Qwen3.5 · 2B](https://huggingface.co/unsloth/Qwen3.5-2B-GGUF/tree/f6d5376be1edb4d416d56da11e5397a961aca8ae) | Conversa, Escrita | 1.28 | 4 | 8 | Apache-2.0 |
| [Qwen3.5 · 4B](https://huggingface.co/unsloth/Qwen3.5-4B-GGUF/tree/e87f176479d0855a907a41277aca2f8ee7a09523) | Conversa, Escrita | 2.74 | 6 | 16 | Apache-2.0 |
| [Qwen3.5 · 9B](https://huggingface.co/unsloth/Qwen3.5-9B-GGUF/tree/3885219b6810b007914f3a7950a8d1b469d598a5) | Conversa, Escrita | 5.68 | 10 | 24 | Apache-2.0 |
| [Qwen3.5 · 27B](https://huggingface.co/unsloth/Qwen3.5-27B-GGUF/tree/3221f178a6b842d04f1fb42f1c413534adcc0a6a) | Conversa, Escrita | 16.74 | 24 | 48 | Apache-2.0 |
| [Ministral 3 · 3B](https://huggingface.co/unsloth/Ministral-3-3B-Instruct-2512-GGUF/tree/7564922f37fa5bbb62b87f09a55c12f1f91d7a6a) | Conversa, Escrita | 2.15 | 5 | 16 | Apache-2.0 |
| [Ministral 3 · 8B](https://huggingface.co/unsloth/Ministral-3-8B-Instruct-2512-GGUF/tree/3731507ec3e867db16d620f73e14d689125758f4) | Conversa, Escrita | 5.20 | 9 | 16 | Apache-2.0 |
| [Qwen3 · Mini](https://huggingface.co/Qwen/Qwen3-0.6B-GGUF/tree/23749fefcc72300e3a2ad315e1317431b06b590a) | Conversa, Escrita | 0.64 | 2 | 8 | Apache-2.0 |
| [SmolLM2 · Leve](https://huggingface.co/HuggingFaceTB/SmolLM2-1.7B-Instruct-GGUF/tree/2d4a76a30b4af41ecd395c35725ac11688d4cfe4) | Conversa, Escrita | 1.06 | 3 | 8 | Apache-2.0 |
| [Qwen3 · Equilibrado](https://huggingface.co/Qwen/Qwen3-4B-GGUF/tree/bc640142c66e1fdd12af0bd68f40445458f3869b) | Conversa, Escrita | 2.50 | 5 | 16 | Apache-2.0 |
| [Qwen3 · Ampliado](https://huggingface.co/Qwen/Qwen3-8B-GGUF/tree/7c41481f57cb95916b40956ab2f0b139b296d974) | Conversa, Escrita | 5.03 | 8 | 16 | Apache-2.0 |
| [Gemma 4 · E2B](https://huggingface.co/google/gemma-4-E2B-it-qat-q4_0-gguf/tree/675cff42a74c774d6cb76f76d8eacb49b48c9b93) | Conversa, Escrita | 3.35 | 6 | 16 | Apache-2.0 |
| [Gemma 4 · E4B](https://huggingface.co/google/gemma-4-E4B-it-qat-q4_0-gguf/tree/4b4a2c1d584be7264f87aac328a1bc739ce81b6c) | Conversa, Escrita | 5.15 | 9 | 16 | Apache-2.0 |
| [Gemma 4 · 12B](https://huggingface.co/google/gemma-4-12B-it-qat-q4_0-gguf/tree/29d097773436b69ff9feafd636ab4cf873786537) | Conversa, Escrita | 6.98 | 11 | 24 | Apache-2.0 |
| [DeepSeek R1 · 1.5B](https://huggingface.co/lmstudio-community/DeepSeek-R1-Distill-Qwen-1.5B-GGUF/tree/29f63ea6272ffa55e5e93632a33a3e2ec95dbd05) | Raciocínio, Conversa | 1.12 | 3 | 8 | MIT · base Qwen Apache-2.0 |
| [DeepSeek R1 · 7B](https://huggingface.co/lmstudio-community/DeepSeek-R1-Distill-Qwen-7B-GGUF/tree/959510a4c8eff7bae27769e9232dca7d3d2b4ed3) | Raciocínio, Conversa | 4.68 | 8 | 16 | MIT · base Qwen Apache-2.0 |
| [DeepSeek R1 · 8B](https://huggingface.co/lmstudio-community/DeepSeek-R1-Distill-Llama-8B-GGUF/tree/d0ac80a21158e6315dccfd568bebfa5b3ed3f1d3) | Raciocínio, Conversa | 4.92 | 9 | 16 | MIT + Llama 3.1 Community |
| [DeepSeek R1 · 14B](https://huggingface.co/lmstudio-community/DeepSeek-R1-Distill-Qwen-14B-GGUF/tree/45db3b6758edf0cf590ff9335c384492d2ee0b5c) | Raciocínio, Conversa | 8.99 | 14 | 24 | MIT · base Qwen Apache-2.0 |
| [DeepSeek R1 · 32B](https://huggingface.co/lmstudio-community/DeepSeek-R1-Distill-Qwen-32B-GGUF/tree/2c8db776f8037c44c2af1fa197699a0d0c6c4b7a) | Raciocínio, Conversa | 19.85 | 26 | 48 | MIT · base Qwen Apache-2.0 |
| [Qwen3 · 1.7B](https://huggingface.co/Qwen/Qwen3-1.7B-GGUF/tree/90862c4b9d2787eaed51d12237eafdfe7c5f6077) | Conversa, Escrita | 1.83 | 4 | 8 | Apache-2.0 |
| [Qwen3 · 14B](https://huggingface.co/Qwen/Qwen3-14B-GGUF/tree/530227a7d994db8eca5ab5ced2fb692b614357fd) | Conversa, Escrita | 9.00 | 14 | 24 | Apache-2.0 |
| [Qwen3 · 30B-A3B](https://huggingface.co/Qwen/Qwen3-30B-A3B-GGUF/tree/e4d4bafdfb96a411a163846265362aceb0b9c63a) | Conversa, Escrita | 18.56 | 25 | 48 | Apache-2.0 |
| [gpt-oss · 20B](https://huggingface.co/ggml-org/gpt-oss-20b-GGUF/tree/ef9b12f2ff56c69cf32153a02784e7a3c88bf524) | Conversa, Escrita | 12.11 | 18 | 32 | Apache-2.0 |
| [gpt-oss · 120B](https://huggingface.co/ggml-org/gpt-oss-120b-GGUF/tree/238abdd290bb874b90a5da1b4549881b7d05c091) | Conversa, Escrita | 63.39 | 80 | 96 | Apache-2.0 |
| [Phi-4 · Mini](https://huggingface.co/bartowski/microsoft_Phi-4-mini-instruct-GGUF/tree/7ff82c2aaa4dde30121698a973765f39be5288c0) | Conversa, Escrita | 2.49 | 5 | 16 | MIT |
| [Llama 3.2 · 3B](https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/tree/5ab33fa94d1d04e903623ae72c95d1696f09f9e8) | Conversa, Escrita | 2.02 | 4 | 8 | Llama 3.2 Community |
| [Mistral · 7B](https://huggingface.co/bartowski/Mistral-7B-Instruct-v0.3-GGUF/tree/61fd4167fff3ab01ee1cfe0da183fa27a944db48) | Conversa, Escrita | 4.37 | 8 | 16 | Apache-2.0 |
| [Qwen Coder · 1.5B](https://huggingface.co/Qwen/Qwen2.5-Coder-1.5B-Instruct-GGUF/tree/f86cb2c1fa58255f8052cc32aeede1b7482d4361) | Código, Conversa | 1.12 | 3 | 8 | Apache-2.0 |
| [Qwen Coder · 7B](https://huggingface.co/Qwen/Qwen2.5-Coder-7B-Instruct-GGUF/tree/13fb94bfda8c8cf22497dc57b78f391a9acb426a) | Código, Conversa | 4.68 | 8 | 16 | Apache-2.0 |
| [Qwen Coder · 14B](https://huggingface.co/Qwen/Qwen2.5-Coder-14B-Instruct-GGUF/tree/d0a692ef765eefbf2fabb130b3cb2e8917e3d225) | Código, Conversa | 8.99 | 14 | 24 | Apache-2.0 |
| [Qwen3-235B-A22B-Instruct-2507](https://huggingface.co/unsloth/Qwen3-235B-A22B-Instruct-2507-GGUF/tree/437d6915c5c512869e4cf8b16b840bbe3fb172bc) | Conversa, Escrita | 142.15 (3 partes) | 167 | 192 | apache-2.0 |
| [DeepSeek-R1-0528](https://huggingface.co/unsloth/DeepSeek-R1-0528-GGUF/tree/72f5d5bd7f0821bc0be039b094cc1501bdbf232a) | Raciocínio, Conversa | 404.94 (9 partes) | 473 | 512 | mit |
| [KAT-Coder-V2.5-Dev](https://huggingface.co/bartowski/Kwaipilot_KAT-Coder-V2.5-Dev-GGUF/tree/d8f684f08d2950ea9d2db6a35ef7dada0707858b) | Código, Conversa | 21.39 | 26 | 32 | apache-2.0 |
| [Qwen3-Next-80B-A3B-Thinking](https://huggingface.co/bartowski/Qwen_Qwen3-Next-80B-A3B-Thinking-GGUF/tree/c36ac5f15be18742fcd09baa61d48dfc016aae79) | Raciocínio, Conversa | 48.73 | 58 | 64 | apache-2.0 |
| [Qwen2.5-7B-Instruct](https://huggingface.co/bartowski/Qwen2.5-7B-Instruct-GGUF/tree/8911e8a47f92bac19d6f5c64a2e2095bd2f7d031) | Conversa, Escrita | 4.68 | 7 | 12 | apache-2.0 |
| [Ling-3.0-tiny](https://huggingface.co/bartowski/Ling-3.0-tiny-GGUF/tree/ea072726af0d2e8ba325b2f90fc0efa762105a91) | Conversa, Escrita | 4.92 | 7 | 12 | mit |
| [Qwen2.5-0.5B-Instruct](https://huggingface.co/bartowski/Qwen2.5-0.5B-Instruct-GGUF/tree/41ba88dbac95fed2528c92514c131d73eb5a174b) | Conversa, Escrita | 0.40 | 2 | 8 | apache-2.0 |
| [Qwen2.5-14B-Instruct](https://huggingface.co/bartowski/Qwen2.5-14B-Instruct-GGUF/tree/05244aa5d871c661c80082a15d3bce44714d068d) | Conversa, Escrita | 8.99 | 12 | 16 | apache-2.0 |
| [Qwen2.5-1.5B-Instruct](https://huggingface.co/bartowski/Qwen2.5-1.5B-Instruct-GGUF/tree/9eadc66189c7641e1ddd226b8267a9119b2ce2d4) | Conversa, Escrita | 0.99 | 3 | 8 | apache-2.0 |
| [Phi-3.5-mini-instruct](https://huggingface.co/bartowski/Phi-3.5-mini-instruct-GGUF/tree/6d70da17e749a471ccb62ade694486011a75cda3) | Conversa, Escrita | 2.39 | 4 | 8 | mit |
| [Qwen2.5-Coder-32B-Instruct](https://huggingface.co/bartowski/Qwen2.5-Coder-32B-Instruct-GGUF/tree/40b525506a4f98ed425882fa6dfc90cc8139065e) | Código, Conversa | 19.85 | 25 | 32 | apache-2.0 |
| [Qwen2.5-32B-Instruct](https://huggingface.co/bartowski/Qwen2.5-32B-Instruct-GGUF/tree/2116cbb385b8ce3a4d28cf3bf1cd2039a55821a6) | Conversa, Escrita | 19.85 | 25 | 32 | apache-2.0 |
| [Qwen2.5-14B_Uncensored_Instruct](https://huggingface.co/bartowski/Qwen2.5-14B_Uncensored_Instruct-GGUF/tree/2e7d5957ae9b9434ab58620f1073cae1fd0cf60a) | Conversa, Escrita | 8.99 | 12 | 16 | apache-2.0 |
| [Olmo-3.1-32B-Think](https://huggingface.co/bartowski/allenai_Olmo-3.1-32B-Think-GGUF/tree/7258621a8adfe86d6ce31bc19c22be2398dbe96a) | Raciocínio, Conversa | 19.48 | 24 | 32 | apache-2.0 |
| [Qwen3-14B-abliterated](https://huggingface.co/bartowski/huihui-ai_Qwen3-14B-abliterated-GGUF/tree/623c0f3fc42a4699d4583fb16e022942c003d1b7) | Conversa, Escrita | 9.00 | 12 | 16 | apache-2.0 |
| [SmolLM3-3B](https://huggingface.co/bartowski/HuggingFaceTB_SmolLM3-3B-GGUF/tree/86b3536ed1ca0dcb4716745642db4e6804bf3d32) | Conversa, Escrita | 1.92 | 4 | 8 | apache-2.0 |
| [SmolLM2-135M-Instruct](https://huggingface.co/bartowski/SmolLM2-135M-Instruct-GGUF/tree/09816acd5d99df7be770d85ea30822623dab342c) | Conversa, Escrita | 0.11 | 2 | 8 | apache-2.0 |
| [Qwen2.5-Coder-7B-Instruct-abliterated](https://huggingface.co/bartowski/Qwen2.5-Coder-7B-Instruct-abliterated-GGUF/tree/a416f57ecabe9841551055493e6945895e54e135) | Código, Conversa | 4.68 | 7 | 12 | apache-2.0 |
| [Kimi-Linear-48B-A3B-Instruct](https://huggingface.co/bartowski/moonshotai_Kimi-Linear-48B-A3B-Instruct-GGUF/tree/228dbe476e5a02091624a19068f4c962caa8a1c5) | Conversa, Escrita | 30.06 | 36 | 48 | mit |
| [Dolphin-Mistral-24B-Venice-Edition](https://huggingface.co/bartowski/cognitivecomputations_Dolphin-Mistral-24B-Venice-Edition-GGUF/tree/708d0be4ed30e671c5121304fe840e02a60beaf0) | Conversa, Escrita | 14.33 | 18 | 24 | apache-2.0 |
| [Qwen2.5-Coder-14B-Instruct-abliterated](https://huggingface.co/bartowski/Qwen2.5-Coder-14B-Instruct-abliterated-GGUF/tree/91e7d17796389c79de80776bbd947afa81c1e34d) | Código, Conversa | 8.99 | 12 | 16 | apache-2.0 |
| [Mistral-Nemo-Instruct-2407](https://huggingface.co/bartowski/Mistral-Nemo-Instruct-2407-GGUF/tree/a2dd64a0a76ea1bdb2bb6ab6fa5496b003c7c908) | Conversa, Escrita | 7.48 | 10 | 16 | apache-2.0 |
| [Qwen3-Coder-Next](https://huggingface.co/bartowski/Qwen_Qwen3-Coder-Next-GGUF/tree/d32741c4b434bf1f927798d0c093564c7f4e92fd) | Código, Conversa | 48.73 | 58 | 64 | apache-2.0 |
| [Huihui-Qwen3-Coder-Next-abliterated](https://huggingface.co/bartowski/huihui-ai_Qwen3-Coder-Next-abliterated-GGUF/tree/4b24fbac95c8496ceb09c3e95d15f9f9d11427d4) | Código, Conversa | 48.56 | 58 | 64 | apache-2.0 |
| [Qwen2.5-Math-1.5B-Instruct](https://huggingface.co/bartowski/Qwen2.5-Math-1.5B-Instruct-GGUF/tree/951ed2aea09c43e331c612e74d83e4a23ca98e3b) | Raciocínio, Conversa | 0.99 | 3 | 8 | apache-2.0 |
| [Ling-3.0-flash](https://huggingface.co/bartowski/Ling-3.0-flash-GGUF/tree/7e1a1243566501d52af98e9aa7a7a61986279c6d) | Conversa, Escrita | 77.80 (2 partes) | 92 | 96 | mit |
| [Nanbeige4.2-3B](https://huggingface.co/bartowski/Nanbeige_Nanbeige4.2-3B-GGUF/tree/17562eefe9752007209148d5f7a6e275fc8d8077) | Conversa, Escrita | 2.68 | 5 | 12 | apache-2.0 |
| [Qwen2.5-Math-7B-Instruct](https://huggingface.co/bartowski/Qwen2.5-Math-7B-Instruct-GGUF/tree/22e2c9c42470193b2b643636564765c84bcb06cb) | Raciocínio, Conversa | 4.68 | 7 | 12 | apache-2.0 |
| [granite-4.2-30b](https://huggingface.co/bartowski/granite-4.2-30b-GGUF/tree/1847d3b70241af9d656f382a4cf29d5c6573e584) | Conversa, Escrita | 18.03 | 22 | 32 | apache-2.0 |
| [Dolphin3.0-Qwen2.5-1.5B](https://huggingface.co/bartowski/Dolphin3.0-Qwen2.5-1.5B-GGUF/tree/0ff632a6d9820453a9d38dbb3fb9b476d6a3f5a9) | Conversa, Escrita | 0.99 | 3 | 8 | apache-2.0 |
| [Qwen3-32B](https://huggingface.co/bartowski/Qwen_Qwen3-32B-GGUF/tree/533fbb1ae5f2ce96c9171acc169e1f68f9352eca) | Conversa, Escrita | 19.76 | 25 | 32 | apache-2.0 |
| [GLM-4.7-Flash](https://huggingface.co/bartowski/zai-org_GLM-4.7-Flash-GGUF/tree/464d07505b441959737cd04d900f047469614c8d) | Conversa, Escrita | 18.47 | 23 | 32 | mit |
| [OLMoE-1B-7B-0924-Instruct](https://huggingface.co/bartowski/OLMoE-1B-7B-0924-Instruct-GGUF/tree/7448e4317d367a3d6838fe367fe996758da6fc6e) | Raciocínio, Conversa | 4.21 | 6 | 12 | apache-2.0 |
| [Qwen2.5-Coder-32B-Instruct-abliterated](https://huggingface.co/bartowski/Qwen2.5-Coder-32B-Instruct-abliterated-GGUF/tree/7cd04a4a248f1fa1c841f9a56b940e9531d290ae) | Código, Conversa | 19.85 | 25 | 32 | apache-2.0 |
| [SmolLM2-360M-Instruct](https://huggingface.co/bartowski/SmolLM2-360M-Instruct-GGUF/tree/7be6f65f1db715fe5dc5a4634c0d459b4eed42ec) | Conversa, Escrita | 0.27 | 2 | 8 | apache-2.0 |
| [granite-20b-code-instruct](https://huggingface.co/bartowski/granite-20b-code-instruct-GGUF/tree/016fa3329fe4e9bbb3c6cee4c3ccf98b5dec9f27) | Código, Conversa | 12.82 | 16 | 24 | apache-2.0 |
| [Qwen3-8B-abliterated](https://huggingface.co/bartowski/mlabonne_Qwen3-8B-abliterated-GGUF/tree/0e66e6f836c802246b69941780ec8ef32670dc09) | Conversa, Escrita | 5.03 | 7 | 12 | apache-2.0 |
| [Yi-Coder-1.5B-Chat](https://huggingface.co/bartowski/Yi-Coder-1.5B-Chat-GGUF/tree/442545c4f577cfdab9a70b38fec719c47d393b8b) | Código, Conversa | 0.96 | 3 | 8 | apache-2.0 |
| [Devstral-Small-2-24B-Instruct-2512](https://huggingface.co/bartowski/mistralai_Devstral-Small-2-24B-Instruct-2512-GGUF/tree/027695770ae1de77c2f6fb19f8e1ba9d65fcd15d) | Código, Conversa | 14.33 | 18 | 24 | apache-2.0 |
| [Phi-3-mini-128k-instruct](https://huggingface.co/bartowski/Phi-3.1-mini-128k-instruct-GGUF/tree/32f6acf8f29d7293ef5a43718796aff2a719e44e) | Conversa, Escrita | 2.39 | 4 | 8 | mit |
| [WhiteRabbitNeo-V3-7B](https://huggingface.co/bartowski/WhiteRabbitNeo_WhiteRabbitNeo-V3-7B-GGUF/tree/5cc667f09d00b213c07530c716a0f900dd59f5aa) | Conversa, Escrita | 4.68 | 7 | 12 | apache-2.0 |
| [MegaBeam-Mistral-7B-512k](https://huggingface.co/bartowski/MegaBeam-Mistral-7B-512k-GGUF/tree/f6a596eaf9072a24f79a9b9a175d2ce103ca665b) | Conversa, Escrita | 4.37 | 7 | 12 | apache-2.0 |
| [phi-4](https://huggingface.co/bartowski/phi-4-GGUF/tree/19cd65f97c2f1712a81c506611d3f9c94b16a1e1) | Conversa, Escrita | 9.05 | 12 | 16 | mit |
| [Mistral-Small-24B-Instruct-2501](https://huggingface.co/bartowski/Mistral-Small-24B-Instruct-2501-GGUF/tree/62a613c92d5a5f73bba6d348b51433b232c4640c) | Conversa, Escrita | 14.33 | 18 | 24 | apache-2.0 |
| [North-Mini-Code-1.0](https://huggingface.co/bartowski/North-Mini-Code-1.0-GGUF/tree/6ff6563002170723a6f7a672bf4c99775be6c0dd) | Código, Conversa | 18.74 | 23 | 32 | apache-2.0 |
| [Qwen2.5-14B_Uncencored](https://huggingface.co/bartowski/Qwen2.5-14B_Uncencored-GGUF/tree/e4ef839bab9ff5b89e5e68e8ae2a3cbc628605c9) | Conversa, Escrita | 8.99 | 12 | 16 | apache-2.0 |
| [Qwen3-Next-80B-A3B-Instruct](https://huggingface.co/bartowski/Qwen_Qwen3-Next-80B-A3B-Instruct-GGUF/tree/c07b9268d97d8ba09d0529980627f3bd70f5f90a) | Conversa, Escrita | 48.73 | 58 | 64 | apache-2.0 |
| [Gemma-4-Novelist-Eclipse-31B](https://huggingface.co/bartowski/Ateron_Gemma-4-Novelist-Eclipse-31B-GGUF/tree/9ec2785f323fe44df5bac7fa107ffdc59b64192d) | Conversa, Escrita | 20.39 | 25 | 32 | apache-2.0 |
| [Olmo-3.1-32B-Instruct](https://huggingface.co/bartowski/allenai_Olmo-3.1-32B-Instruct-GGUF/tree/9333dd15d3493f228eccc9723f67cb6cdb77fb6d) | Raciocínio, Conversa | 19.48 | 24 | 32 | apache-2.0 |
| [Glistening-Gem-31B-v2.0](https://huggingface.co/bartowski/sophosympatheia_Glistening-Gem-31B-v2.0-GGUF/tree/ba984949aab21e14be2c85aecece5dc39d312cf1) | Conversa, Escrita | 19.60 | 24 | 32 | apache-2.0 |
| [Qwen2.5-32B-AGI](https://huggingface.co/bartowski/Qwen2.5-32B-AGI-GGUF/tree/343ac91b21054eca220b9dc6a08c8c04f04d525f) | Conversa, Escrita | 19.85 | 25 | 32 | apache-2.0 |
| [Phi-3-mini-4k-instruct](https://huggingface.co/bartowski/Phi-3.1-mini-4k-instruct-GGUF/tree/66a614ace4d069a12c2f6043f4ea92621c898d4a) | Conversa, Escrita | 2.39 | 4 | 8 | mit |
| [granite-4.2-8b](https://huggingface.co/bartowski/granite-4.2-8b-GGUF/tree/a592100df8fe4931c7cffbac7b28e8176a1d52da) | Conversa, Escrita | 5.54 | 8 | 12 | apache-2.0 |
| [Phi-3.5-mini-instruct_Uncensored](https://huggingface.co/bartowski/Phi-3.5-mini-instruct_Uncensored-GGUF/tree/ee8d5d6896f1ac8d0f95f7dff87bc2b2d7aa6e72) | Conversa, Escrita | 2.39 | 4 | 8 | apache-2.0 |
| [Mistral-Small-24B-Instruct-2501-abliterated](https://huggingface.co/bartowski/huihui-ai_Mistral-Small-24B-Instruct-2501-abliterated-GGUF/tree/710fa4d4a7bb81385efbbf5256c919b1195fa514) | Conversa, Escrita | 14.33 | 18 | 24 | apache-2.0 |
| [G9v3-3B](https://huggingface.co/bartowski/ai9stars_G9v3-3B-GGUF/tree/11fe5d21c70f1c6f5e66ca433d1a533738998225) | Conversa, Escrita | 1.90 | 4 | 8 | apache-2.0 |
| [v6-Finch-7B-HF](https://huggingface.co/bartowski/v6-Finch-7B-HF-GGUF/tree/ac36c828d44824254baafb221a15c4fe902cb68a) | Conversa, Escrita | 4.78 | 7 | 12 | apache-2.0 |
| [Phi-4-reasoning-plus](https://huggingface.co/bartowski/microsoft_Phi-4-reasoning-plus-GGUF/tree/96b602db19694b8323c8638ad771289fb5be0863) | Raciocínio, Conversa | 9.05 | 12 | 16 | mit |
| [Laguna-XS-2.1](https://huggingface.co/bartowski/Laguna-XS-2.1-GGUF/tree/8f7579d6ab7d3122716100116cf1a62f490ab6f3) | Conversa, Escrita | 20.55 | 25 | 32 | openmdw-1.1 |
| [QwQ-32B-abliterated](https://huggingface.co/bartowski/huihui-ai_QwQ-32B-abliterated-GGUF/tree/7086e7f19ce31617f6ed21f452ef28c270576576) | Raciocínio, Conversa | 19.85 | 25 | 32 | apache-2.0 |
| [Phi-3-medium-4k-instruct](https://huggingface.co/bartowski/Phi-3-medium-4k-instruct-GGUF/tree/2e478770bcb73c17668a4f9fa028e8c8228f6fb4) | Conversa, Escrita | 8.57 | 11 | 16 | mit |
| [Qwen2.5-Coder-14B](https://huggingface.co/bartowski/Qwen2.5-Coder-14B-GGUF/tree/0e179a81290a5e9b04bb1b4f1badf79bc880b261) | Código, Conversa | 8.99 | 12 | 16 | apache-2.0 |
| [Ling-3.0-flash-Fin](https://huggingface.co/bartowski/Ling-3.0-flash-Fin-GGUF/tree/a792b6bd51d2cb47b5aa8687ff5dd4f2974acdb4) | Conversa, Escrita | 77.80 (2 partes) | 92 | 96 | mit |
| [Rombos-LLM-V2.5-Qwen-14b](https://huggingface.co/bartowski/Replete-LLM-V2.5-Qwen-14b-GGUF/tree/7e2bac14ec5aab23d2a1b286314da2db995c4f69) | Conversa, Escrita | 8.99 | 12 | 16 | apache-2.0 |
| [Peach-9B-8k-Roleplay](https://huggingface.co/bartowski/Peach-9B-8k-Roleplay-GGUF/tree/54f224c29f64339e063a5037eea3fc1f19cb76dd) | Escrita, Conversa | 5.33 | 8 | 12 | mit |
| [DeepSeek-R1-0528-Qwen3-8B](https://huggingface.co/bartowski/deepseek-ai_DeepSeek-R1-0528-Qwen3-8B-GGUF/tree/75b8e3d4ecafa21b1f9a06209712f726d0ed77bc) | Raciocínio, Conversa | 5.03 | 7 | 12 | mit |
| [Qwen2.5-VL-32B-Instruct](https://huggingface.co/bartowski/Qwen_Qwen2.5-VL-32B-Instruct-GGUF/tree/da3f1818472b91c1a0c6d15f79a2c133b67ae016) | Conversa, Escrita | 19.85 | 25 | 32 | apache-2.0 |
| [phi3.5-gutenberg-4B](https://huggingface.co/bartowski/phi3.5-gutenberg-4B-GGUF/tree/c612c0f519f219a32d680cf090424f0baf9905ad) | Conversa, Escrita | 2.39 | 4 | 8 | mit |
| [Gemma-4-31B-StyleTune](https://huggingface.co/bartowski/Gryphe_Gemma-4-31B-StyleTune-GGUF/tree/48c25e900473b10f0487c37191c58f727b470515) | Conversa, Escrita | 20.39 | 25 | 32 | apache-2.0 |
| [Hy3](https://huggingface.co/bartowski/Hy3-GGUF/tree/3ee5a3c4d76226edd9cdaec017969d24b589b64e) | Conversa, Escrita | 182.16 (5 partes) | 214 | 256 | apache-2.0 |
| [Behemoth-128B-v3](https://huggingface.co/bartowski/TheDrummer_Behemoth-128B-v3-GGUF/tree/3efe0f8305084ad7d2d9e590fcf47ea68467bc06) | Conversa, Escrita | 78.41 (2 partes) | 93 | 128 | apache-2.0 |
| [SmolLM-1.7B-Instruct-v0.2](https://huggingface.co/bartowski/SmolLM-1.7B-Instruct-v0.2-GGUF/tree/647435534b383ba5e4aeff797074c4a6e327099e) | Conversa, Escrita | 1.06 | 3 | 8 | apache-2.0 |
| [Phi-3-medium-128k-instruct](https://huggingface.co/bartowski/Phi-3-medium-128k-instruct-GGUF/tree/950c8154e91f33193217eebf1c26903af44c6e13) | Conversa, Escrita | 8.57 | 11 | 16 | mit |
| [DeepScaleR-1.5B-Preview](https://huggingface.co/bartowski/agentica-org_DeepScaleR-1.5B-Preview-GGUF/tree/9632aa047524c44510438cb3a7bc6262833e9014) | Conversa, Escrita | 1.12 | 3 | 8 | mit |
| [AFM-4.5B](https://huggingface.co/bartowski/arcee-ai_AFM-4.5B-GGUF/tree/7c01c520766d940d39da6874cce439de7f9b8b79) | Conversa, Escrita | 2.92 | 5 | 12 | apache-2.0 |
| [Phi-3.5-mini-3.8B-ArliAI-RPMax-v1.1](https://huggingface.co/bartowski/Phi-3.5-mini-3.8B-ArliAI-RPMax-v1.1-GGUF/tree/e2cb7d402d2b539ddf264ac6c5afed7b79e551e5) | Conversa, Escrita | 2.39 | 4 | 8 | mit |
| [GLM-4-32B-0414](https://huggingface.co/bartowski/THUDM_GLM-4-32B-0414-GGUF/tree/b650220dbf94ac4b4423e9aaa2f230629929e65f) | Conversa, Escrita | 19.68 | 24 | 32 | mit |
| [granite-4.2-3b](https://huggingface.co/bartowski/granite-4.2-3b-GGUF/tree/4093456941a783ab5d8268e00a7725532c1e9af3) | Conversa, Escrita | 2.32 | 4 | 8 | apache-2.0 |
| [magnum-12b-v2](https://huggingface.co/bartowski/magnum-12b-v2-GGUF/tree/d4d67420ba1568cdbe63161b180f38a5745b23e3) | Escrita, Conversa | 7.48 | 10 | 16 | apache-2.0 |
| [granite-embedding-107m-multilingual](https://huggingface.co/bartowski/granite-embedding-107m-multilingual-GGUF/tree/52fed1c818636b7cb8c4e4e3ae73189efeb78081) | Conversa, Escrita | 0.12 | 2 | 8 | apache-2.0 |
| [Phi-3.5-MoE-instruct](https://huggingface.co/bartowski/Phi-3.5-MoE-instruct-GGUF/tree/4b580329100cf44d7d041b6f63967b26869a6937) | Conversa, Escrita | 25.35 | 31 | 48 | mit |
| [QwQ-32B-Preview](https://huggingface.co/bartowski/QwQ-32B-Preview-GGUF/tree/8f5be0e405df00fdc3cc2905ca63aaccedafd59f) | Raciocínio, Conversa | 19.85 | 25 | 32 | apache-2.0 |
| [granite-3.1-8b-instruct](https://huggingface.co/bartowski/granite-3.1-8b-instruct-GGUF/tree/7a0f633d54069de889707a76353bc28b70361d9f) | Conversa, Escrita | 4.94 | 7 | 12 | apache-2.0 |
| [granite-3.1-3b-a800m-instruct](https://huggingface.co/bartowski/granite-3.1-3b-a800m-instruct-GGUF/tree/be9a36f042806cb586bc65556c527079782b78e0) | Conversa, Escrita | 2.02 | 4 | 8 | apache-2.0 |
| [GLM-4.6-Derestricted](https://huggingface.co/bartowski/ArliAI_GLM-4.6-Derestricted-GGUF/tree/1a1e9ad00ce8275babd33e9a560cddea31fa7224) | Conversa, Escrita | 217.65 (6 partes) | 255 | 384 | mit |
| [SuperNova-Medius](https://huggingface.co/bartowski/SuperNova-Medius-GGUF/tree/24aea8e4d840631c6a4460a4fb8d4a602fe8978b) | Conversa, Escrita | 8.99 | 12 | 16 | apache-2.0 |
| [Dans-PersonalityEngine-V1.3.0-24b](https://huggingface.co/bartowski/PocketDoc_Dans-PersonalityEngine-V1.3.0-24b-GGUF/tree/88b0671ffe0dbb4238ff356e681c4774cfd81be8) | Conversa, Escrita | 14.33 | 18 | 24 | apache-2.0 |
| [EVA-Qwen2.5-14B-v0.2](https://huggingface.co/bartowski/EVA-Qwen2.5-14B-v0.2-GGUF/tree/b515210d59dce34e630c1ea7d5c6237bbd993547) | Conversa, Escrita | 8.99 | 12 | 16 | apache-2.0 |
| [h2o-danube3-500m-chat](https://huggingface.co/bartowski/h2o-danube3-500m-chat-GGUF/tree/34005c67faf918e19c8748e501fa8418b51060fe) | Conversa, Escrita | 0.32 | 2 | 8 | apache-2.0 |
| [Athene-Phi-3.5-mini-instruct-orpo](https://huggingface.co/bartowski/Athene-Phi-3.5-mini-instruct-orpo-GGUF/tree/f0db5923958cacc543fd4cb1f4eed9a669801f80) | Conversa, Escrita | 2.32 | 4 | 8 | apache-2.0 |
| [Qwen2.5-Coder-1.5B-Instruct-abliterated](https://huggingface.co/bartowski/Qwen2.5-Coder-1.5B-Instruct-abliterated-GGUF/tree/823ab8183896816dec7d29899310b556e655ad73) | Código, Conversa | 1.12 | 3 | 8 | apache-2.0 |
| [Chocolatine-3B-Instruct-DPO-v1.2](https://huggingface.co/bartowski/Chocolatine-3B-Instruct-DPO-v1.2-GGUF/tree/7add663d60409ca2cec43a36f14aac97a11e4f26) | Conversa, Escrita | 2.39 | 4 | 8 | mit |
| [Rombos-LLM-V2.5-Qwen-32b](https://huggingface.co/bartowski/Replete-LLM-V2.5-Qwen-32b-GGUF/tree/98f2e0176a42623de898973e19d8284e0dfebfbc) | Conversa, Escrita | 19.85 | 25 | 32 | apache-2.0 |
| [Qwen2.5-7B-Instruct-1M](https://huggingface.co/bartowski/Qwen2.5-7B-Instruct-1M-GGUF/tree/381ac2097f05bff2f77e7e3864239c11e521c3d3) | Conversa, Escrita | 4.68 | 7 | 12 | apache-2.0 |
| [Trinity-Large-Preview](https://huggingface.co/bartowski/arcee-ai_Trinity-Large-Preview-GGUF/tree/84c2fdf3c073f4040d0aa5fd49f94a8b8485ee24) | Conversa, Escrita | 241.63 (7 partes) | 283 | 384 | apache-2.0 |
| [GLM-4-9B-0414](https://huggingface.co/bartowski/THUDM_GLM-4-9B-0414-GGUF/tree/211924cd949e153b1017ed635e5b127d0b594e6f) | Conversa, Escrita | 6.17 | 9 | 16 | mit |
| [EVA-Qwen2.5-14B-v0.0](https://huggingface.co/bartowski/EVA-Qwen2.5-14B-v0.0-GGUF/tree/346362a9a3f9415a359eb0ca1d410b22aa536a2f) | Conversa, Escrita | 8.99 | 12 | 16 | apache-2.0 |
| [EVA-Yi-1.5-9B-32K-V1](https://huggingface.co/bartowski/EVA-Yi-1.5-9B-32K-V1-GGUF/tree/61a39f9e83831d48953b994a1e16a4812990fee4) | Conversa, Escrita | 5.33 | 8 | 12 | apache-2.0 |
| [v6-Finch-3B-HF](https://huggingface.co/bartowski/v6-Finch-3B-HF-GGUF/tree/fe634cc776e04e8ff0e4d2c2ad9e88d160ac9ee9) | Conversa, Escrita | 1.92 | 4 | 8 | apache-2.0 |
| [Devstral-Small-2505](https://huggingface.co/bartowski/mistralai_Devstral-Small-2505-GGUF/tree/80bbcce0bd66019a0a01bb5ba786d5a7ce36743a) | Código, Conversa | 14.33 | 18 | 24 | apache-2.0 |
| [GLM-4.7](https://huggingface.co/bartowski/zai-org_GLM-4.7-GGUF/tree/c47ba4573051e4a5146879669a8a95743b5302a4) | Conversa, Escrita | 218.52 (6 partes) | 256 | 384 | mit |
| [Yi-Coder-9B-Chat](https://huggingface.co/bartowski/Yi-Coder-9B-Chat-GGUF/tree/2f28bfc370a5457310f3880202b2ed577e2bcbd8) | Código, Conversa | 5.33 | 8 | 12 | apache-2.0 |
| [magnum-v4-72b](https://huggingface.co/bartowski/magnum-v4-72b-GGUF/tree/ca33bb8535824d076d24e96b9ec1a98e8c73f7a4) | Escrita, Conversa | 47.42 | 57 | 64 | apache-2.0 |
| [Laguna-S-2.1](https://huggingface.co/bartowski/Laguna-S-2.1-GGUF/tree/66e90acc3ff8d007a084c0360ae6ffcd3ede66e7) | Conversa, Escrita | 71.76 (2 partes) | 85 | 96 | openmdw-1.1 |
| [magnum-12b-v2.5-kto](https://huggingface.co/bartowski/magnum-12b-v2.5-kto-GGUF/tree/257981239785936710a670e874698994230d1a4f) | Escrita, Conversa | 7.48 | 10 | 16 | apache-2.0 |
| [MiniMax-M2-THRIFT](https://huggingface.co/bartowski/VibeStudio_MiniMax-M2-THRIFT-GGUF/tree/7327091f2e078b24e31befaca97a6104c12809fc) | Conversa, Escrita | 104.61 (3 partes) | 123 | 128 | mit |
| [WhiteRabbitNeo-2.5-Qwen-2.5-Coder-7B](https://huggingface.co/bartowski/WhiteRabbitNeo-2.5-Qwen-2.5-Coder-7B-GGUF/tree/4874da7ad5fa4da4f2584ae64ddc21f5a8e7dfce) | Código, Conversa | 4.68 | 7 | 12 | apache-2.0 |
| [Rombos-LLM-V2.5-Qwen-7b](https://huggingface.co/bartowski/Replete-LLM-V2.5-Qwen-7b-GGUF/tree/aeb63e506a399e9aa9f67bcf72a8e4a534a621c6) | Conversa, Escrita | 4.68 | 7 | 12 | apache-2.0 |
| [Dans-PersonalityEngine-V1.2.0-24b](https://huggingface.co/bartowski/PocketDoc_Dans-PersonalityEngine-V1.2.0-24b-GGUF/tree/fadbf535d1e9d2d6be631710588e65017440bb31) | Conversa, Escrita | 14.33 | 18 | 24 | apache-2.0 |
| [EuroLLM-9B-Instruct](https://huggingface.co/bartowski/EuroLLM-9B-Instruct-GGUF/tree/55e5590cc457e42ed197c34c5b10403472b05d54) | Conversa, Escrita | 5.58 | 8 | 12 | apache-2.0 |
| [Pantheon-RP-1.6-12b-Nemo](https://huggingface.co/bartowski/Pantheon-RP-1.6-12b-Nemo-GGUF/tree/93e39f765735dc35e0038768e0d2064ad596e2ee) | Conversa, Escrita | 7.48 | 10 | 16 | apache-2.0 |
| [Stheno-Hercules-3.1-8B](https://huggingface.co/bartowski/Stheno-Hercules-3.1-8B-GGUF/tree/ca1932dd8055509a6990885b559d21f521608542) | Conversa, Escrita | 4.92 | 7 | 12 | apache-2.0 |
| [Qwen3-Gutenberg-Encore-14B](https://huggingface.co/bartowski/nbeerbower_Qwen3-Gutenberg-Encore-14B-GGUF/tree/65ec68f1c8824d5b7774603033cc40a492974fc8) | Conversa, Escrita | 9.00 | 12 | 16 | apache-2.0 |
| [GLM-Z1-Rumination-32B-0414](https://huggingface.co/bartowski/THUDM_GLM-Z1-Rumination-32B-0414-GGUF/tree/a9866d8e8acdb6f55cebce95d850cb99c32306b5) | Conversa, Escrita | 20.04 | 25 | 32 | mit |
| [GLM-Z1-9B-0414](https://huggingface.co/bartowski/THUDM_GLM-Z1-9B-0414-GGUF/tree/01173fe01f49347f098c9dc4454dc3fd7bd15e2e) | Conversa, Escrita | 6.17 | 9 | 16 | mit |
| [Qwythos-9B-v2](https://huggingface.co/bartowski/empero-ai_Qwythos-9B-v2-GGUF/tree/3f233570b07f7a3bc2570b975cbb210fec72efb4) | Conversa, Escrita | 6.05 | 9 | 16 | apache-2.0 |
| [Mixtral-8x22B-v0.1](https://huggingface.co/bartowski/zephyr-orpo-141b-A35b-v0.1-GGUF/tree/304d0311e1a2764d3ab1689e2dd4911b9e20f132) | Conversa, Escrita | 85.59 (5 partes) | 101 | 128 | apache-2.0 |
| [reka-flash-3](https://huggingface.co/bartowski/RekaAI_reka-flash-3-GGUF/tree/02951df8711b30e85faaa672a4ec4c3c3c6c0e37) | Conversa, Escrita | 13.61 | 17 | 24 | apache-2.0 |
| [INTELLECT-3](https://huggingface.co/bartowski/PrimeIntellect_INTELLECT-3-GGUF/tree/1827cd1b39b3f3ced9319c94079d71bad75ee8c3) | Conversa, Escrita | 71.36 (2 partes) | 85 | 96 | mit |
| [QwQ-32B](https://huggingface.co/bartowski/Qwen_QwQ-32B-GGUF/tree/390cc7b31baedc55a4d094802995e75f40b4a86d) | Raciocínio, Conversa | 19.85 | 25 | 32 | apache-2.0 |
| [deepseek-r1-qwen-2.5-32B-ablated](https://huggingface.co/bartowski/deepseek-r1-qwen-2.5-32B-ablated-GGUF/tree/afde0eea2076ec0be023c2bdc046f3c35be3449a) | Raciocínio, Conversa | 19.85 | 25 | 32 | mit |
| [Rombos-LLM-V2.5-Qwen-3b](https://huggingface.co/bartowski/Replete-LLM-V2.5-Qwen-3b-GGUF/tree/3a62c65f56ac3446f323f5faa772fa41a3b96ee1) | Conversa, Escrita | 2.10 | 4 | 8 | apache-2.0 |
| [GrayLine-Qwen3-14B](https://huggingface.co/bartowski/soob3123_GrayLine-Qwen3-14B-GGUF/tree/1ff1c0f5f3ccb785b9f0329a8980e88a80e53e27) | Conversa, Escrita | 9.00 | 12 | 16 | apache-2.0 |
| [UncensoredLM-DeepSeek-R1-Distill-Qwen-14B](https://huggingface.co/bartowski/uncensoredai_UncensoredLM-DeepSeek-R1-Distill-Qwen-14B-GGUF/tree/d00f6b074564c188e3c2022e381d909df7220b4a) | Raciocínio, Conversa | 8.64 | 12 | 16 | apache-2.0 |
| [Replete-LLM-Mist-Nemo-12b-test-merged-250k](https://huggingface.co/bartowski/Replete-LLM-Mist-Nemo-12b-test-merged-250k-GGUF/tree/0dcd904580ca3a2e6f13ef3aef12ac5875ac7b28) | Conversa, Escrita | 7.48 | 10 | 16 | apache-2.0 |
| [MN-12B-Celeste-V1.9](https://huggingface.co/bartowski/MN-12B-Celeste-V1.9-GGUF/tree/7033b26627026d034a1ad0ca0ecf27df824d9f67) | Conversa, Escrita | 7.48 | 10 | 16 | apache-2.0 |
| [Pantheon-Proto-RP-1.8-30B-A3B](https://huggingface.co/bartowski/Gryphe_Pantheon-Proto-RP-1.8-30B-A3B-GGUF/tree/bce24e9f1fa6b44b89d02f610e1bca55fb77f3d3) | Conversa, Escrita | 18.63 | 23 | 32 | apache-2.0 |
| [BlackSheep-RP-12B](https://huggingface.co/bartowski/BlackSheep-RP-12B-GGUF/tree/b46e317e2e95347a66c86567bbbaf0a8c41a86cf) | Conversa, Escrita | 7.48 | 10 | 16 | artistic-2.0 |
| [mathstral-7B-v0.1](https://huggingface.co/bartowski/mathstral-7B-v0.1-GGUF/tree/37c8ee4527abbcc564fddddd6d21484f2852bf19) | Raciocínio, Conversa | 4.37 | 7 | 12 | apache-2.0 |
| [Trinity-Large-Base](https://huggingface.co/bartowski/arcee-ai_Trinity-Large-Base-GGUF/tree/8fec8d21d49cd193d7c0cff76e8cfad902867a2d) | Conversa, Escrita | 241.63 (7 partes) | 283 | 384 | apache-2.0 |
| [DeepCoder-14B-Preview](https://huggingface.co/bartowski/agentica-org_DeepCoder-14B-Preview-GGUF/tree/f8698074b914519e6f922e1b78df6b7c41871157) | Código, Conversa | 8.99 | 12 | 16 | mit |
| [Magistry-24B-v1.1](https://huggingface.co/bartowski/sophosympatheia_Magistry-24B-v1.1-GGUF/tree/0374d789228b4f59aa83f04fdb0b76e1c91d8bc0) | Conversa, Escrita | 14.57 | 18 | 24 | apache-2.0 |
| [OpenBuddy-R1-0528-Distill-Qwen3-32B-Preview0-QAT](https://huggingface.co/bartowski/OpenBuddy_OpenBuddy-R1-0528-Distill-Qwen3-32B-Preview0-QAT-GGUF/tree/b21b3c6eed7a0ff19781c7d3237836200509670e) | Conversa, Escrita | 19.76 | 25 | 32 | apache-2.0 |
| [EVA-Qwen2.5-7B-v0.1](https://huggingface.co/bartowski/EVA-Qwen2.5-7B-v0.1-GGUF/tree/33487f3377864da5eb23c4270f23ef7115492806) | Conversa, Escrita | 4.68 | 7 | 12 | apache-2.0 |
| [INTELLECT-1-Instruct](https://huggingface.co/bartowski/INTELLECT-1-Instruct-GGUF/tree/7293422e6c759528ad110db71fc0b8c60623d12e) | Conversa, Escrita | 6.23 | 9 | 16 | apache-2.0 |
| [Qwen2.5-14B-Instruct-1M](https://huggingface.co/bartowski/Qwen2.5-14B-Instruct-1M-GGUF/tree/f9f82825ed669910c9083619190a2931eec1c980) | Conversa, Escrita | 8.99 | 12 | 16 | apache-2.0 |
| [Qwen3-4B-Instruct-2507-heretic](https://huggingface.co/bartowski/p-e-w_Qwen3-4B-Instruct-2507-heretic-GGUF/tree/374467f099f99156987afeeea6df5bc1f090ff4b) | Conversa, Escrita | 2.50 | 4 | 8 | apache-2.0 |
| [Replete-Coder-V2-Llama-3.1-8b](https://huggingface.co/bartowski/Replete-Coder-V2-Llama-3.1-8b-GGUF/tree/e80817f13320284b984a914a2d483946b218f9d7) | Código, Conversa | 4.92 | 7 | 12 | apache-2.0 |
| [Replete-Coder-Instruct-8b-Merged](https://huggingface.co/bartowski/Replete-Coder-Instruct-8b-Merged-GGUF/tree/9270656ebf28eada1c9c2c99939f53f955c555ac) | Código, Conversa | 4.92 | 7 | 12 | apache-2.0 |
| [gpt-oss-20b-heretic](https://huggingface.co/bartowski/p-e-w_gpt-oss-20b-heretic-GGUF/tree/7d1cdd0b512682dae86ea5e6064dad760ca76815) | Conversa, Escrita | 15.85 | 20 | 24 | apache-2.0 |
| [granite-3.1-2b-instruct](https://huggingface.co/bartowski/granite-3.1-2b-instruct-GGUF/tree/e47b8b46c04cede00f9e19d5a846551b14b2efce) | Conversa, Escrita | 1.55 | 3 | 8 | apache-2.0 |
| [Rombos-LLM-V2.5-Qwen-72b](https://huggingface.co/bartowski/Replete-LLM-V2.5-Qwen-72b-GGUF/tree/afa772f9303ef20d4f637f0081554a637cca3069) | Conversa, Escrita | 47.42 | 57 | 64 | apache-2.0 |
| [Grug-35B-A3B](https://huggingface.co/bartowski/kai-os_Grug-35B-A3B-GGUF/tree/fbf57bd449595c612bd274a18064f9895312616d) | Conversa, Escrita | 21.39 | 26 | 32 | apache-2.0 |
| [TwinLlama-3.1-8B-DPO3](https://huggingface.co/bartowski/TwinLlama-3.1-8B-DPO3-GGUF/tree/6ccd2e9df2a525394e8f80fbe990e85809f03341) | Conversa, Escrita | 4.92 | 7 | 12 | apache-2.0 |
| [Lite-Mistral-150M-v2-Instruct](https://huggingface.co/bartowski/Lite-Mistral-150M-v2-Instruct-GGUF/tree/d567b686ecb900bad15fa0d9a999f010f5ba9925) | Conversa, Escrita | 0.10 | 2 | 8 | apache-2.0 |
| [Mistral-Small-24B-Base-2501](https://huggingface.co/bartowski/mistralai_Mistral-Small-24B-Base-2501-GGUF/tree/9c27a3049cd742cc8bb4cdaa4001a930c5a0431e) | Conversa, Escrita | 14.33 | 18 | 24 | apache-2.0 |
| [Aion-RP-Llama-3.1-8B](https://huggingface.co/bartowski/Aion-RP-Llama-3.1-8B-GGUF/tree/3fcccafd5550b18e36c47a59cc847e621ef4700d) | Conversa, Escrita | 4.92 | 7 | 12 | apache-2.0 |
| [Replete-LLM-Qwen2-7b](https://huggingface.co/bartowski/Replete-LLM-Qwen2-7b-GGUF/tree/bdbe5a08789d3324a1a1379a76053a62c8c48c86) | Conversa, Escrita | 4.68 | 7 | 12 | apache-2.0 |
| [Pantheon-RP-1.6.1-12b-Nemo](https://huggingface.co/bartowski/Pantheon-RP-1.6.1-12b-Nemo-GGUF/tree/4be7dcd5084b60cb65fb9403adfe73055b46bffe) | Conversa, Escrita | 7.48 | 10 | 16 | apache-2.0 |
| [h2o-danube3-4b-chat](https://huggingface.co/bartowski/h2o-danube3-4b-chat-GGUF/tree/65b8be0e2c24d695559177db2cfdcc0da98b55fd) | Conversa, Escrita | 2.39 | 4 | 8 | apache-2.0 |
| [HuatuoGPT-o1-7B](https://huggingface.co/bartowski/HuatuoGPT-o1-7B-GGUF/tree/5b481e71fa41e2ccffdd863dc01f27be48075bd1) | Conversa, Escrita | 4.68 | 7 | 12 | apache-2.0 |
| [DeepCoder-1.5B-Preview](https://huggingface.co/bartowski/agentica-org_DeepCoder-1.5B-Preview-GGUF/tree/ea501cd265c00ceba066ed21a08228090a676e51) | Código, Conversa | 1.12 | 3 | 8 | mit |
| [DeepSWE-Preview](https://huggingface.co/bartowski/agentica-org_DeepSWE-Preview-GGUF/tree/1a8015681b46c4767c27a588a253a5a225d01b69) | Conversa, Escrita | 19.76 | 25 | 32 | mit |
| [Bielik-11B-v2.2-Instruct](https://huggingface.co/bartowski/Bielik-11B-v2.2-Instruct-GGUF/tree/2e1957da95367a0ca8bb72ad29c7bd71b843f064) | Conversa, Escrita | 6.72 | 9 | 16 | apache-2.0 |
| [OmniCoder-9B](https://huggingface.co/bartowski/Tesslate_OmniCoder-9B-GGUF/tree/f0fbc2243f49ab2dbdf91fe5930dd73e6bce767c) | Código, Conversa | 5.91 | 8 | 12 | apache-2.0 |
| [Qwen2.5-Coder-32B](https://huggingface.co/bartowski/Qwen2.5-Coder-32B-GGUF/tree/37d0a0274ae3f00a8788d15dfd1a6de9bbc84c0b) | Código, Conversa | 19.85 | 25 | 32 | apache-2.0 |
| [amoral-gemma3-4B](https://huggingface.co/bartowski/soob3123_amoral-gemma3-4B-GGUF/tree/74e80676eebd3def4d42f5f6d9998e6590dcfe87) | Conversa, Escrita | 2.49 | 4 | 8 | apache-2.0 |
| [nomic-embed-code](https://huggingface.co/bartowski/nomic-ai_nomic-embed-code-GGUF/tree/e237621d1dfbaa357592ed8641a50c3db03d2dc7) | Código, Conversa | 4.38 | 7 | 12 | apache-2.0 |
| [Hermes-4.3-36B](https://huggingface.co/bartowski/NousResearch_Hermes-4.3-36B-GGUF/tree/56b57c47136327060928c009c5164be185e4d4e9) | Conversa, Escrita | 21.76 | 27 | 32 | apache-2.0 |
| [Mistral-Nemo-12B-ArliAI-RPMax-v1.1](https://huggingface.co/bartowski/Mistral-Nemo-12B-ArliAI-RPMax-v1.1-GGUF/tree/03b69d4267651ec59a2604e777b8930f694811c5) | Conversa, Escrita | 7.48 | 10 | 16 | apache-2.0 |
| [DeepHermes-3-Mistral-24B-Preview](https://huggingface.co/bartowski/NousResearch_DeepHermes-3-Mistral-24B-Preview-GGUF/tree/dab8d56bb3a768b3a7794307c07f5e5a25d4f720) | Conversa, Escrita | 14.33 | 18 | 24 | apache-2.0 |
| [Qwen2.5-32B-ArliAI-RPMax-v1.3](https://huggingface.co/bartowski/Qwen2.5-32B-ArliAI-RPMax-v1.3-GGUF/tree/dbdacf702472630074b3006e641f954116451fa6) | Conversa, Escrita | 19.85 | 25 | 32 | apache-2.0 |
| [MiroThinker-v1.0-8B](https://huggingface.co/bartowski/miromind-ai_MiroThinker-v1.0-8B-GGUF/tree/6120f85ddfdabe25c8e9557030aab12b30308f5e) | Raciocínio, Conversa | 5.03 | 7 | 12 | mit |
| [EVA-Qwen2.5-32B-v0.1](https://huggingface.co/bartowski/EVA-Qwen2.5-32B-v0.1-GGUF/tree/a1be6e3ff66c4b3ff1410f8891c553ee343ee7a5) | Conversa, Escrita | 19.85 | 25 | 32 | apache-2.0 |
| [EVA-Qwen2.5-32B-v0.2](https://huggingface.co/bartowski/EVA-Qwen2.5-32B-v0.2-GGUF/tree/95b74243c8579142d7f9f828a618ab31933de079) | Conversa, Escrita | 19.85 | 25 | 32 | apache-2.0 |
| [Darwin-36B-Opus](https://huggingface.co/bartowski/FINAL-Bench_Darwin-36B-Opus-GGUF/tree/5c3de7cbc3d33d68d37aa98489490b5e26acc75e) | Conversa, Escrita | 21.39 | 26 | 32 | apache-2.0 |
| [EuroLLM-22B-Instruct-2512](https://huggingface.co/bartowski/utter-project_EuroLLM-22B-Instruct-2512-GGUF/tree/1dbd312ffa10e83e5faa855e3727cbf4abc45f08) | Conversa, Escrita | 13.66 | 17 | 24 | apache-2.0 |
| [Olmo-3-7B-Instruct](https://huggingface.co/bartowski/allenai_Olmo-3-7B-Instruct-GGUF/tree/0d00999146ae9606a15cf049858a2ccf46fe0706) | Raciocínio, Conversa | 4.47 | 7 | 12 | apache-2.0 |
| [remnant-qwen3-8b](https://huggingface.co/bartowski/allura-org_remnant-qwen3-8b-GGUF/tree/b88bf2a071340da9f599a1f5d9e1efa1a7b8f8a9) | Conversa, Escrita | 5.03 | 7 | 12 | apache-2.0 |
| [calme-2.1-phi3.5-4b](https://huggingface.co/bartowski/calme-2.1-phi3.5-4b-GGUF/tree/250bd653bb3440481d645b5f1e124b461b03871e) | Conversa, Escrita | 2.39 | 4 | 8 | mit |
| [Qwen2.5-Coder-0.5B-Instruct-abliterated](https://huggingface.co/bartowski/Qwen2.5-Coder-0.5B-Instruct-abliterated-GGUF/tree/876ebfffa80d443367f647bb6e6b2aa2d33a4001) | Código, Conversa | 0.40 | 2 | 8 | apache-2.0 |
| [FuseO1-DeepSeekR1-Qwen2.5-Coder-32B-Preview](https://huggingface.co/bartowski/FuseO1-DeepSeekR1-Qwen2.5-Coder-32B-Preview-v0.1-GGUF/tree/25634f876571a0d2bcb5e9a3a5f4a27264cd4043) | Código, Conversa | 19.85 | 25 | 32 | apache-2.0 |
| [Merlin-Agent](https://huggingface.co/bartowski/Merlin-Research_Merlin-Agent-GGUF/tree/5cc1de11a4641704c73d79720127e2d6cd13c0c2) | Conversa, Escrita | 5.91 | 8 | 12 | apache-2.0 |
| [Qwen2.5-Coder-0.5B](https://huggingface.co/bartowski/Qwen2.5-Coder-0.5B-GGUF/tree/01c1b8072277dfbfd0d051ec95b7a43bb23d2f6a) | Código, Conversa | 0.40 | 2 | 8 | apache-2.0 |
| [Phi-4-reasoning](https://huggingface.co/bartowski/microsoft_Phi-4-reasoning-GGUF/tree/31acd2bdedae7114e095a73bd3d14a026f85bd71) | Raciocínio, Conversa | 9.05 | 12 | 16 | mit |
| [Qwen2.5-32b-RP-Ink](https://huggingface.co/bartowski/Qwen2.5-32b-RP-Ink-GGUF/tree/ada803e9c8c64feae7685ebef73a0d6f789b7f5c) | Conversa, Escrita | 19.85 | 25 | 32 | apache-2.0 |
| [functionary-small-v3.2](https://huggingface.co/bartowski/functionary-small-v3.2-GGUF/tree/388ea44bed3d1c7d5cc6b5a52e8b188386cbadb7) | Conversa, Escrita | 4.92 | 7 | 12 | mit |
| [Mistral-Nemo-Prism-12B](https://huggingface.co/bartowski/Mistral-Nemo-Prism-12B-GGUF/tree/057f3a8966f32061f234a3c4d787e30e28982c69) | Conversa, Escrita | 7.48 | 10 | 16 | apache-2.0 |
| [Sailor2-8B-Chat](https://huggingface.co/bartowski/Sailor2-8B-Chat-GGUF/tree/10972d4314c4f4f332b07c327103b85e9027234a) | Conversa, Escrita | 5.24 | 8 | 12 | apache-2.0 |
| [Vikhr-Gemma-2B-instruct](https://huggingface.co/bartowski/Vikhr-Gemma-2B-instruct-GGUF/tree/bce63f33c930f13063f025547e95b150f5962b9d) | Conversa, Escrita | 1.71 | 3 | 8 | apache-2.0 |
| [Bonsai-8B-unpacked](https://huggingface.co/bartowski/prism-ml_Bonsai-8B-unpacked-GGUF/tree/f10ef5f1756beeeacd7508a0e4c0990e547ab589) | Conversa, Escrita | 5.20 | 8 | 12 | apache-2.0 |
| [QwQ-32B-Preview-abliterated](https://huggingface.co/bartowski/QwQ-32B-Preview-abliterated-GGUF/tree/cfbe7737202100a692da2bca17216ab64b208ec5) | Raciocínio, Conversa | 19.85 | 25 | 32 | apache-2.0 |
| [Replete-LLM-V2-Llama-3.1-8b](https://huggingface.co/bartowski/Replete-LLM-V2-Llama-3.1-8b-GGUF/tree/149a2910b8ff40a6ef21039b682b1e8959961187) | Conversa, Escrita | 4.92 | 7 | 12 | apache-2.0 |
| [Rombos-LLM-V2.5-Qwen-1.5b](https://huggingface.co/bartowski/Replete-LLM-V2.5-Qwen-1.5b-GGUF/tree/4f13dc4d26cedbd5688b0cdb76668776e9f3f49e) | Conversa, Escrita | 1.12 | 3 | 8 | apache-2.0 |
| [Qwen3.6-35B-A3B-Anko](https://huggingface.co/bartowski/allura-org_Qwen3.6-35B-A3B-Anko-GGUF/tree/13f18e6d67716b2702480449bd8b4b55f6677c38) | Conversa, Escrita | 21.39 | 26 | 32 | apache-2.0 |
| [Homunculus](https://huggingface.co/bartowski/arcee-ai_Homunculus-GGUF/tree/f2d40529a92b0b088648e26c6b219e04c89dbdf5) | Conversa, Escrita | 7.62 | 10 | 16 | apache-2.0 |
| [granite-3.0-2b-instruct](https://huggingface.co/bartowski/granite-3.0-2b-instruct-GGUF/tree/ca090672129c29718cb397fbf50ee5949442fb84) | Conversa, Escrita | 1.60 | 3 | 8 | apache-2.0 |
| [Mellum2-12B-A2.5B-Instruct](https://huggingface.co/bartowski/Mellum2-12B-A2.5B-Instruct-GGUF/tree/978d3b633817824470ef48a53141e3dccf1863f0) | Conversa, Escrita | 8.17 | 11 | 16 | apache-2.0 |
| [MSM-MS-Cydrion-22B](https://huggingface.co/bartowski/MSM-MS-Cydrion-22B-GGUF/tree/1f79b3faf1565762a95650964b7bb7c1cbecdb0e) | Conversa, Escrita | 13.34 | 17 | 24 | apache-2.0 |
| [OLMo-2-1124-13B-Instruct](https://huggingface.co/bartowski/OLMo-2-1124-13B-Instruct-GGUF/tree/00f2e4aed2fdcac064c1b9613ce2d520f54369e2) | Raciocínio, Conversa | 8.35 | 11 | 16 | apache-2.0 |
| [GLM-4.7-Flash-heretic](https://huggingface.co/bartowski/jtl11_GLM-4.7-Flash-heretic-GGUF/tree/57ff23f6018db26c0056ebba18cfb16dafb79cf5) | Conversa, Escrita | 18.54 | 23 | 32 | mit |
| [granite-3.3-8b-instruct](https://huggingface.co/bartowski/ibm-granite_granite-3.3-8b-instruct-GGUF/tree/000bcc0448c24671ca97c24b2daa6dd693abc625) | Conversa, Escrita | 4.94 | 7 | 12 | apache-2.0 |
| [MN-2407-DSK-QwQify-v0.1-12B](https://huggingface.co/bartowski/BeaverAI_MN-2407-DSK-QwQify-v0.1-12B-GGUF/tree/9b07ea0f6f6a3c487fb2121b26a3cf60a4c9487f) | Raciocínio, Conversa | 7.48 | 10 | 16 | apache-2.0 |
| [Qwen2.5-Coder-0.5B-Instruct](https://huggingface.co/bartowski/Qwen2.5-Coder-0.5B-Instruct-GGUF/tree/69a2c192eed24297fb09a34d8ba948b8624cc3e2) | Código, Conversa | 0.40 | 2 | 8 | apache-2.0 |
| [magnum-v2-4b](https://huggingface.co/bartowski/magnum-v2-4b-GGUF/tree/552104ce36ce0a1e2937ca1e559cc2236ffb0db5) | Escrita, Conversa | 2.78 | 5 | 12 | apache-2.0 |
| [Kuvera-8B-v0.1.0](https://huggingface.co/bartowski/Akhil-Theerthala_Kuvera-8B-v0.1.0-GGUF/tree/edb8d5d16e755f77aa75d718f9c00dfa5adaadd0) | Conversa, Escrita | 5.03 | 7 | 12 | mit |
| [Phi-4-mini-reasoning](https://huggingface.co/bartowski/microsoft_Phi-4-mini-reasoning-GGUF/tree/519790c46093945c24bed49875702ad9126c721c) | Raciocínio, Conversa | 2.49 | 4 | 8 | mit |
| [EVA-Qwen2.5-32B-v0.0](https://huggingface.co/bartowski/EVA-Qwen2.5-32B-v0.0-GGUF/tree/8e01d326511a7d52c1692c995d487ae987cc2e03) | Conversa, Escrita | 19.85 | 25 | 32 | apache-2.0 |
| [CalmeRys-78B-Orpo-v0.1](https://huggingface.co/bartowski/CalmeRys-78B-Orpo-v0.1-GGUF/tree/5630b376d04d1cf099227405307fe0d667d874c3) | Conversa, Escrita | 50.70 (2 partes) | 61 | 96 | mit |
| [Dolphin3.0-Qwen2.5-0.5B](https://huggingface.co/bartowski/Dolphin3.0-Qwen2.5-0.5B-GGUF/tree/2a4428efa5a7377c4404d0b9ff16ce41e52047b8) | Conversa, Escrita | 0.40 | 2 | 8 | apache-2.0 |

Metadados conferidos em 10/09/2026 pela API de blobs do Hugging Face. Tamanhos em bytes, arquivos, commits e hashes completos estão em `src/catalog.ts`. Google/Gemma e Qwen3 usam arquivos publicados pelos próprios projetos; Qwen3.5 e Ministral 3 usam conversões Unsloth; outros arquivos são conversões identificadas na ficha. Os GGUF incluem tokenizer. Gemma neste aplicativo é somente texto, sem projetores multimodais.

Fontes de licença e capacidades: [Gemma 4](https://deepmind.google/models/gemma/gemma-4/), [DeepSeek R1 e licenças das bases destiladas](https://huggingface.co/deepseek-ai/DeepSeek-R1), [Phi-4 Mini](https://huggingface.co/microsoft/Phi-4-mini-instruct), [modelos abertos OpenAI](https://help.openai.com/en/articles/11870455-openai-open-weight-models). Para cada arquivo, a tabela liga à revisão de origem. Llama usa licença comunitária; as destilações DeepSeek baseadas em Llama preservam condições da base.

## Operação 0.5

O pacote inclui llama.cpp e executa GGUF diretamente. Baixe, instale e escolha a versão marcada **integrado**. Arquivos novos ficam na pasta de modelos da Colmeia; GGUFs da pasta padrão do LM Studio são reutilizados sem cópia. No Mac, MLX também pode rodar diretamente: use Adicionar MLX no Chat para copiar a pasta de um modelo. Arquivos de modelos externos continuam listados separadamente. Consulte [MLX independente](mlx-independente.md).

Uma instância integrada por vez, contexto solicitado e verificado, flash attention, admissão de RAM e descarregamento ao bloquear/fechar. Minha API pode usar esse mesmo modelo; desligue-a antes de trocar a IA compartilhada. O motor externo ainda pode ampliar o contexto. Arquivos baixados têm tamanho e SHA-256 conferidos; arquivos preexistentes não são automaticamente revalidados.

Consulte [motor e assistente](motor-e-assistente.md) para uso de ferramentas, armazenamento, compilação e limites por formato.

## Limites

O catálogo não inclui todos os modelos existentes. É possível usar modelos adicionais instalados manualmente no LM Studio. Qualidade, consumo de RAM e compatibilidade de cada arquivo ainda não foram homologados. Não há revalidação de hash a cada inferência depois da importação. Modelos grandes, em especial gpt-oss 120B, exigem computadores com muita memória. Não há imagens, áudio ou atualização automática assinada do catálogo. Busca web e terminal com revisão estão disponíveis no modo Assistente.

## Imagem e vídeo

As 6 referências visuais ficam separadas por finalidade: FLUX.1-schnell, Qwen-Image e SDXL (imagem); Wan2.1-T2V-1.3B, Wan2.2-TI2V-5B e CogVideoX-2b (vídeo). São links aos arquivos oficiais, sem instalação ou geração visual integrada. Requisitos e tamanhos precisam ser consultados na configuração do motor visual escolhido. VRAM é memória de vídeo; não confundir com a RAM total do computador.

## Catálogo 0.7

200 novos modelos/fine-tunes distintos, uma quantização por entrada. Licenças declaradas nas novas fontes: Apache-2.0, MIT, Artistic-2.0 e OpenMDW-1.1. As categorias são usos sugeridos pela família/ficha, sem pontuação comparativa. Consulte também a licença do modelo original. Metadados exatos: `src/catalog.ts`; procedência: `docs/catalog-sources.json`. Para conferir novamente os commits, bytes e hashes publicados sem baixar pesos: `npm run build && python3 scripts/verify-catalog.py`.

15 das novas opções usam GGUF dividido em partes. Todas as partes são verificadas e apresentadas ao motor como um conjunto; conjuntos incompletos não aparecem como instalados. O download interrompido pode ser refeito desde o início. Estimativa nova de RAM: pesos × 1,25 + 1 GiB, arredondada para cima, para contexto curto; a margem de carregamento é adicional. O PC sugerido também deixa espaço para o sistema. Qwen3 235B ocupa 142,15 GB de disco e tem estimativa de 167 GiB de RAM; DeepSeek R1 671B ocupa 404,94 GB e estima 473 GiB. Nenhum dos dois foi carregado neste Mac de 24 GiB.
