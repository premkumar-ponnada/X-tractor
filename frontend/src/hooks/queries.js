import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { jobApi, runApi, sdkApi, statsApi, systemApi } from '@/lib/api/endpoints'
import { FINISHED_JOB } from '@/constants/app'

export const keys = {
  sdks: ['sdks'],
  sdk: (name) => ['sdks', name],
  overview: ['stats', 'overview'],
  sdkStats: ['stats', 'sdks'],
  health: ['health'],
  jobs: (params) => ['jobs', params],
  job: (id) => ['job', id],
  report: (id) => ['job', id, 'report'],
  compare: (id, fileId) => ['job', id, 'compare', fileId],
  run: (id) => ['run', id],
  pages: (id) => ['run', id, 'pages'],
  output: (id, format) => ['run', id, 'output', format],
}

export const useSdks = () => useQuery({ queryKey: keys.sdks, queryFn: sdkApi.list, staleTime: 60_000 })
export const useSdk = (name) => useQuery({ queryKey: keys.sdk(name), queryFn: () => sdkApi.get(name), enabled: !!name })
export const useOverview = () => useQuery({ queryKey: keys.overview, queryFn: statsApi.overview, refetchInterval: 15_000 })
export const useSdkStats = () => useQuery({ queryKey: keys.sdkStats, queryFn: statsApi.sdks })
export const useHealth = () => useQuery({ queryKey: keys.health, queryFn: systemApi.health, refetchInterval: 20_000, retry: false })

export const useJobs = (params) =>
  useQuery({
    queryKey: keys.jobs(params),
    queryFn: () => jobApi.list(params),
    placeholderData: keepPreviousData,
    refetchInterval: (query) => (query.state.data?.items?.some((j) => !FINISHED_JOB.has(j.status)) ? 5_000 : false),
  })

export const useJob = (id, { live = false } = {}) =>
  useQuery({
    queryKey: keys.job(id),
    queryFn: () => jobApi.get(id),
    enabled: !!id,
    // Live pages get pushed events; this poll is only a safety net.
    refetchInterval: (query) => (live && !FINISHED_JOB.has(query.state.data?.status) ? 4_000 : false),
  })

export const useReport = (id) => useQuery({ queryKey: keys.report(id), queryFn: () => jobApi.report(id), enabled: !!id })
export const useCompare = (id, fileId) =>
  useQuery({ queryKey: keys.compare(id, fileId), queryFn: () => jobApi.compare(id, fileId), enabled: !!id && !!fileId })
export const useRunPages = (id) =>
  useQuery({ queryKey: keys.pages(id), queryFn: () => runApi.pages(id), enabled: !!id, staleTime: Infinity })
export const useRunOutput = (id, format) =>
  useQuery({ queryKey: keys.output(id, format), queryFn: () => runApi.output(id, format), enabled: !!id && !!format, staleTime: Infinity })

function useJobAction(fn) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: (data, id) => {
      if (data) queryClient.setQueryData(keys.job(id), data)
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      queryClient.invalidateQueries({ queryKey: keys.overview })
    },
  })
}

export const useCancelJob = () => useJobAction(jobApi.cancel)
export const useRetryJob = () => useJobAction(jobApi.retry)
export const useDeleteJob = () => useJobAction(jobApi.remove)
