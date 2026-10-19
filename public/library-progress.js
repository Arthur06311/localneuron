export function mergeLibraryProgress(status, progress) {
  if (!status || progress.revision !== status.revision) return { status, refreshCatalog: true };
  const jobs = new Map((progress.jobs || []).map(job => [job.id, job]));
  return {
    refreshCatalog: false,
    status: {
      ...status,
      busy: progress.busy,
      disk_free_bytes: progress.disk_free_bytes,
      available_memory_bytes: progress.available_memory_bytes,
      total_memory_bytes: progress.total_memory_bytes,
      media_downloads: progress.media_downloads,
      studio_download: progress.studio_download,
      catalog: status.catalog.map(model => ({ ...model, job: jobs.get(model.id) ?? null })),
    },
  };
}
