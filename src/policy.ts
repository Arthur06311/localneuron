import { z } from 'zod';
import { parse } from 'yaml';
import { hash, validSignature } from '../scripts/protocol.mjs';
import type { Action, Grant, Identity, Workflow } from './types.js';

export const TOOLS = ['content.compose', 'files.commit_version', 'document.validate'];
const workflowSchema = z.strictObject({ id: z.string().regex(/^[a-z][a-z0-9-]{1,50}$/), version: z.number().int().positive(), title: z.string().min(1).max(120), policy: z.literal('local'), budget_minor: z.number().int().nonnegative().max(1000000), allowed_tools: z.array(z.enum(TOOLS as [string, ...string[]])).min(1), required_checks: z.array(z.enum(['requirements', 'duration', 'human_review'])).min(1), steps: z.array(z.strictObject({ tool: z.string() })).min(1).max(10) });
export function parseWorkflow(source: string, scope: string[]): Workflow {
  if (Buffer.byteLength(source) > 32768) throw new Error('Fluxo excede 32 KB');
  const workflow = workflowSchema.parse(parse(source, { maxAliasCount: 0 }));
  if (workflow.allowed_tools.some(tool => !scope.includes(tool)) || workflow.steps.some(step => !workflow.allowed_tools.includes(step.tool))) throw new Error('Fluxo pede capacidade não concedida');
  if (JSON.stringify(workflow.steps.map(step => step.tool)) !== JSON.stringify(TOOLS)) throw new Error('Esta Alfa executa somente compor, versionar e validar, nessa ordem');
  if (!['requirements', 'duration', 'human_review'].every(check => workflow.required_checks.includes(check as any))) throw new Error('Verificações obrigatórias ausentes');
  return { ...workflow, source_hash: hash(source) };
}
const actionSchema = z.strictObject({ tool: z.enum(TOOLS as [string, ...string[]]), task_id: z.string().uuid(), input_hash: z.string().regex(/^[0-9a-f]{64}$/), destination: z.literal('local'), cost_minor: z.number().int().nonnegative().max(1000000) });
export function judge(action: Action, grant: Grant | null, agent: Identity, human: Identity, scope: string[], workflow: Workflow, logId: string, now = Date.now()) {
  actionSchema.parse(action);
  if (agent.kind !== 'agent' || human.kind !== 'human' || agent.owner_id !== human.id) throw new Error('Responsabilidade inválida');
  if (agent.revoked_seq !== null || human.revoked_seq !== null) throw new Error('Identidade revogada');
  if (!scope.includes(action.tool) || !workflow.allowed_tools.includes(action.tool)) throw new Error('Ferramenta fora do escopo');
  if (action.cost_minor > workflow.budget_minor) throw new Error('Custo excede o teto do fluxo');
  if (!grant || !validSignature(grant.body, grant.signature, human.public_key)) throw new Error('Cossinatura humana ausente ou inválida');
  const body = grant.body;
  if (body.action_hash !== hash(action) || body.agent_id !== agent.id || body.human_id !== human.id || body.log_id !== logId || body.task_id !== action.task_id || body.epoch !== agent.epoch || body.expires_at < now || body.issued_at > now) throw new Error('Autorização expirada ou fora do escopo');
  return { allowed: true, rule: 'local.explicit-human-grant.v1' };
}
