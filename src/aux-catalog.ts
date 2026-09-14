import {MEDIA_CATALOG} from './media-catalog.js';
export type AuxModel = {id:string;name:string;engine:"whisper"|"diffusion";kind:"speech"|"image"|"video";description:string;license:string;ram_gib:number;files:{repo:string;revision:string;path:string;file:string;bytes:number;sha256:string;role:string}[]};
export const AUX_CATALOG: AuxModel[] = [
  {
    "id": "whisper-tiny",
    "name": "Whisper tiny",
    "engine": "whisper",
    "kind": "speech",
    "description": "Leve · transforma fala em texto, incluindo português, sem enviar áudio para nuvem.",
    "license": "MIT",
    "ram_gib": 1,
    "files": [
      {
        "repo": "ggerganov/whisper.cpp",
        "revision": "5359861c739e955e79d9a303bcbc70fb988958b1",
        "path": "ggml-tiny.bin",
        "file": "ggml-tiny.bin",
        "bytes": 77691713,
        "sha256": "be07e048e1e599ad46341c8d2a135645097a538221678b7acdd1b1919c6e1b21",
        "role": "model"
      }
    ]
  },
  {
    "id": "whisper-base",
    "name": "Whisper base",
    "engine": "whisper",
    "kind": "speech",
    "description": "Equilibrado · transforma fala em texto, incluindo português, sem enviar áudio para nuvem.",
    "license": "MIT",
    "ram_gib": 1,
    "files": [
      {
        "repo": "ggerganov/whisper.cpp",
        "revision": "5359861c739e955e79d9a303bcbc70fb988958b1",
        "path": "ggml-base.bin",
        "file": "ggml-base.bin",
        "bytes": 147951465,
        "sha256": "60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe",
        "role": "model"
      }
    ]
  },
  {
    "id": "whisper-small",
    "name": "Whisper small",
    "engine": "whisper",
    "kind": "speech",
    "description": "Mais preciso · transforma fala em texto, incluindo português, sem enviar áudio para nuvem.",
    "license": "MIT",
    "ram_gib": 2,
    "files": [
      {
        "repo": "ggerganov/whisper.cpp",
        "revision": "5359861c739e955e79d9a303bcbc70fb988958b1",
        "path": "ggml-small.bin",
        "file": "ggml-small.bin",
        "bytes": 487601967,
        "sha256": "1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b",
        "role": "model"
      }
    ]
  },
  {
    "id": "whisper-large-v3-turbo",
    "name": "Whisper large-v3-turbo",
    "engine": "whisper",
    "kind": "speech",
    "description": "Turbo · transforma fala em texto, incluindo português, sem enviar áudio para nuvem.",
    "license": "MIT",
    "ram_gib": 4,
    "files": [
      {
        "repo": "ggerganov/whisper.cpp",
        "revision": "5359861c739e955e79d9a303bcbc70fb988958b1",
        "path": "ggml-large-v3-turbo.bin",
        "file": "ggml-large-v3-turbo.bin",
        "bytes": 1624555275,
        "sha256": "1fc70f774d38eb169993ac391eea357ef47c88757ef72ee5943879b7e8e2bc69",
        "role": "model"
      }
    ]
  },
  {
    "id": "sd15",
    "name": "Stable Diffusion 1.5",
    "engine": "diffusion",
    "kind": "image",
    "description": "Gera imagens a partir de uma descrição. Modelo compacto para começar com ilustrações e cenas em 512 pixels.",
    "license": "CreativeML OpenRAIL-M",
    "ram_gib": 6,
    "files": [
      {
        "repo": "stable-diffusion-v1-5/stable-diffusion-v1-5",
        "revision": "451f4fe16113bff5a5d2269ed5ad43b0592e9a14",
        "path": "v1-5-pruned-emaonly.safetensors",
        "file": "v1-5-pruned-emaonly.safetensors",
        "bytes": 4265146304,
        "sha256": "6ce0161689b3853acaa03779ec93eafe75a02f4ced659bee03f50797806fa2fa",
        "role": "model"
      }
    ]
  },
  {
    "id": "wan21",
    "name": "Wan 2.1 · 1.3B",
    "engine": "diffusion",
    "kind": "video",
    "description": "Experimental: gera prévias curtas de vídeo em 256 × 256. Economiza memória com pesos quantizados; pode produzir artefatos e pouca definição.",
    "license": "Apache-2.0 (modelo original); consulte as conversões",
    "ram_gib": 6,
    "files": [
      {
        "repo": "calcuis/wan-1.3b-gguf",
        "revision": "0652f175f44055eb60cca26dd7cd89c14abe22ce",
        "path": "wan2.1_t2v_1.3b-q4_k_m.gguf",
        "file": "wan2.1_t2v_1.3b-q4_k_m.gguf",
        "bytes": 1034031328,
        "sha256": "f3c1a3fb984d49d3963cc4a93d4f5103deef5909eb5e948513fb6c6d582a350e",
        "role": "diffusion"
      },
      {
        "repo": "city96/umt5-xxl-encoder-gguf",
        "revision": "b535255bee98c2b0a59ea7c0ae2dcd0c6657b3b7",
        "path": "umt5-xxl-encoder-Q3_K_M.gguf",
        "file": "umt5-xxl-encoder-Q3_K_M.gguf",
        "bytes": 3055097696,
        "sha256": "b7e2ca4c493c9d51fa951005e8ceba2f4b6b6877cfb4c36a8955c6cd68a1dba7",
        "role": "t5"
      },
      {
        "repo": "Comfy-Org/Wan_2.1_ComfyUI_repackaged",
        "revision": "617a7633e636506f850e043bc4605f290a466a8e",
        "path": "split_files/vae/wan_2.1_vae.safetensors",
        "file": "wan_2.1_vae.safetensors",
        "bytes": 253815318,
        "sha256": "2fc39d31359a4b0a64f55876d8ff7fa8d780956ae2cb13463b0223e15148976b",
        "role": "vae"
      }
    ]
  }
];

export const LOCAL_MODELS:AuxModel[]=[...AUX_CATALOG,...MEDIA_CATALOG.filter(m=>m.local_profile==='sd15'&&!m.profile_id).map(m=>{const f=m.files[m.profile_file!];return {id:m.id,name:m.name,engine:'diffusion' as const,kind:'image' as const,description:m.description+' Perfil SD 1.x; qualidade não homologada.',license:m.license,ram_gib:6,files:[{repo:m.repo,revision:m.revision,path:f.path,file:f.path,bytes:f.bytes,sha256:f.sha256,role:'model'}]};})];
