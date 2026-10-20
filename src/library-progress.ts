import { createHash } from 'node:crypto';

type RevisionJob = { id: string; state: string; downloaded?: number; total?: number; error?: string; model_key?: string };
type RevisionMediaJob = { model: string; file: number; state: string; downloaded?: number; total?: number; error?: string };
type RevisionProfile = { id: string; installed?: boolean; partial?: boolean };
type RevisionStudio = { state?: string; error?: string; model?: string } | null;
type RevisionAccess = { checked_at?: unknown; public?: number; restricted?: number; unsupported?: number; total?: number };

export function libraryRevision(input: {
  busy: boolean;
  jobs: RevisionJob[];
  media: { busy: boolean; jobs: RevisionMediaJob[] };
  studio: RevisionStudio;
  profiles: RevisionProfile[];
  catalogIds: string[];
  access: RevisionAccess;
}) {
  const body = {
    busy: input.busy,
    jobs: input.jobs.map(job => [job.id, job.state, job.error ?? '', job.model_key ?? '']).sort(),
    mediaBusy: input.media.busy,
    media: input.media.jobs.map(job => [job.model, job.file, job.state, job.error ?? '']).sort(),
    studio: input.studio ? [input.studio.state ?? '', input.studio.error ?? '', input.studio.model ?? ''] : null,
    profiles: input.profiles.map(profile => [profile.id, Boolean(profile.installed), Boolean(profile.partial)]).sort(),
    catalogIds: [...input.catalogIds].sort(),
    access: [String(input.access.checked_at ?? ''), input.access.public ?? 0, input.access.restricted ?? 0, input.access.unsupported ?? 0, input.access.total ?? 0],
  };
  return createHash('sha256').update(JSON.stringify(body)).digest('hex').slice(0, 20);
}
