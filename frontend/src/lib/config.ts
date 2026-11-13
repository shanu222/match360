import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import type { AppConfig } from './types';

export const useConfig = () => useQuery({ queryKey: ['config'], queryFn: () => api.get<AppConfig>('/config'), staleTime: 5 * 60_000 });
