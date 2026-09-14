import { z } from 'zod';
import { optionsSchema } from './inference.js';
export const optimizationSchema = z.strictObject({key:z.string().min(1).max(512),mode:z.enum(['economy','balanced','extended']),options:optionsSchema});
type Model = {key:string;size_bytes?:number;format?:string;loaded_instances?:{id:string;config?:{context_length?:number}}[]};
/** Conservative estimate, using the same model/context overhead as the integrated runtime. */
export function optimizeContext(model: Model, available: number, mode: 'economy'|'balanced'|'extended', options: z.infer<typeof optionsSchema>) {
  if(!model.size_bytes||!Number.isFinite(available))throw Error('O modelo não informa tamanho suficiente para ajustar a RAM automaticamente. Use o ajuste manual.');
  const gib=1024**3, mlx=model.format==='MLX';
  const base=model.size_bytes*(mlx?1:1.25)+(mlx?.5:1)*gib;
  const target={economy:4096,balanced:8192,extended:32768}[mode];
  const loaded=model.loaded_instances?.[0]?.config?.context_length;
  const budget=available+(loaded?base+Math.max(0,loaded-4096)*32768:0);
  const choices=[2048,4096,8192,16384,32768].filter(n=>n<=target&&base+Math.max(0,n-4096)*32768+1.5*gib<=budget);
  if(!choices.length)throw Error('RAM insuficiente para este modelo com margem de segurança. Libere memória ou escolha uma IA menor.');
  let context=choices.at(-1)!;
  // Reuse a compatible loaded context to avoid unloading/reloading identical weights.
  if(loaded && loaded<=context && loaded>=target/2 && choices.includes(loaded))context=loaded;
  return {options:optionsSchema.parse({...options,context,max_tokens:Math.min(options.max_tokens,context/2)}),estimated_bytes:Math.ceil(base+Math.max(0,context-4096)*32768),reuses_loaded_context:loaded===context,mode,explanation:`Contexto de ${context.toLocaleString('pt-BR')} tokens, com margem estimada de RAM.${loaded===context?' Mantém o contexto já carregado.':''} A velocidade e a qualidade dependem do modelo e do computador.`};
}
