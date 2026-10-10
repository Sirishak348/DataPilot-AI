import axios from 'axios';
import {
  AuthResponse,
  DatasetItem,
  DatasetProfile,
  DatasetPreview,
  CleaningOperation,
  DiffSummary,
  DerivedRecommendation,
  MLTrainRequest,
  MLTrainResponse,
  ChatMessage,
  AIHealthStatus,
  User,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

// Request interceptor to attach bearer token
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('datapilot_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor to catch 401s
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    return Promise.reject(error);
  }
);

// Generic Authenticated File Download Helper
export const downloadAuthenticatedBlob = async (url: string, defaultFilename: string) => {
  const response = await apiClient.get(url, { responseType: 'blob' });
  const headers = response.headers as Record<string, any>;
  const contentType = (headers['content-type'] as string) || 'application/octet-stream';
  const blob = new Blob([response.data], { type: contentType });

  // Extract filename from Content-Disposition if present
  let filename = defaultFilename;
  const disposition = headers['content-disposition'] as string | undefined;
  if (disposition && typeof disposition === 'string' && disposition.indexOf('filename=') !== -1) {
    const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
    if (match && match[1]) {
      filename = match[1].replace(/['"]/g, '');
    }
  }

  const blobUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(blobUrl);
};

// Auth API
export const authApi = {
  register: (email: string, password: string, full_name?: string) =>
    apiClient.post<AuthResponse>('/api/auth/register', { email, password, full_name }).then((r) => r.data),
  login: (email: string, password: string) =>
    apiClient.post<AuthResponse>('/api/auth/login/json', { email, password }).then((r) => r.data),
  demoLogin: () =>
    apiClient.post<AuthResponse>('/api/auth/demo-login').then((r) => r.data),
  getMe: () =>
    apiClient.get<User>('/api/auth/me').then((r) => r.data),
};

// Datasets API
export const datasetsApi = {
  list: () =>
    apiClient.get<DatasetItem[]>('/api/datasets').then((r) => r.data),
  get: (id: string) =>
    apiClient.get<DatasetItem & { profile_data?: DatasetProfile }>(`/api/datasets/${id}`).then((r) => r.data),
  upload: (file: File, name?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    if (name) formData.append('name', name);
    return apiClient.post<any>('/api/datasets/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data);
  },
  loadSample: (sampleType: 'churn' | 'housing' | 'segmentation') =>
    apiClient.post<any>(`/api/datasets/sample/${sampleType}`).then((r) => r.data),
  getPreview: (id: string, page = 1, pageSize = 25, search = '', useCleaned = false) =>
    apiClient
      .get<DatasetPreview>(`/api/datasets/${id}/preview`, {
        params: { page, page_size: pageSize, search: search || undefined, use_cleaned: useCleaned },
      })
      .then((r) => r.data),
  delete: (id: string) =>
    apiClient.delete(`/api/datasets/${id}`).then((r) => r.data),
  getDownloadUrl: (id: string, version: 'original' | 'cleaned' = 'original') =>
    `/api/datasets/${id}/download?version=${version}`,
  downloadCsv: (id: string, version: 'original' | 'cleaned' = 'original', defaultFilename = 'dataset.csv') =>
    downloadAuthenticatedBlob(`/api/datasets/${id}/download?version=${version}`, defaultFilename),
};

// Profiling API
export const profilingApi = {
  getProfile: (id: string, refresh = false, useCleaned = false) =>
    apiClient
      .get<DatasetProfile>(`/api/datasets/${id}/profile`, {
        params: { refresh, use_cleaned: useCleaned },
      })
      .then((r) => r.data),
};

// Cleaning API
export const cleaningApi = {
  preview: (id: string, operations: CleaningOperation[], saveAsNew = false) =>
    apiClient
      .post<DiffSummary>(`/api/datasets/${id}/preview-clean`, { operations, save_as_new: saveAsNew })
      .then((r) => r.data),
  apply: (id: string, operations: CleaningOperation[], saveAsNew = false, newDatasetName?: string) =>
    apiClient
      .post<{ message: string; dataset_id: string; diff_summary: DiffSummary }>(
        `/api/datasets/${id}/apply-clean`,
        { operations, save_as_new: saveAsNew, new_dataset_name: newDatasetName }
      )
      .then((r) => r.data),
  reset: (id: string) =>
    apiClient.post(`/api/datasets/${id}/reset-clean`).then((r) => r.data),
  getDerivedRecommendations: (id: string, useCleaned = false) =>
    apiClient
      .get<DerivedRecommendation[]>(`/api/datasets/${id}/derived-recommendations`, {
        params: { use_cleaned: useCleaned },
      })
      .then((r) => r.data),
};

// EDA API
export const edaApi = {
  getHistogram: (id: string, column: string, bins = 20, useCleaned = false) =>
    apiClient
      .get(`/api/datasets/${id}/eda/histogram`, {
        params: { column, bins, use_cleaned: useCleaned },
      })
      .then((r) => r.data),
  getBoxplot: (id: string, numericColumn: string, groupBy?: string, useCleaned = false) =>
    apiClient
      .get(`/api/datasets/${id}/eda/boxplot`, {
        params: { numeric_column: numericColumn, group_by: groupBy || undefined, use_cleaned: useCleaned },
      })
      .then((r) => r.data),
  getViolin: (id: string, numericColumn: string, groupBy?: string, useCleaned = false) =>
    apiClient
      .get(`/api/datasets/${id}/eda/violin`, {
        params: { numeric_column: numericColumn, group_by: groupBy || undefined, use_cleaned: useCleaned },
      })
      .then((r) => r.data),
  getCorrelations: (id: string, useCleaned = false) =>
    apiClient
      .get(`/api/datasets/${id}/eda/correlations`, {
        params: { use_cleaned: useCleaned },
      })
      .then((r) => r.data),
  getScatter: (id: string, x: string, y: string, color?: string, sampleSize = 1000, useCleaned = false) =>
    apiClient
      .get(`/api/datasets/${id}/eda/scatter`, {
        params: { x, y, color: color || undefined, sample_size: sampleSize, use_cleaned: useCleaned },
      })
      .then((r) => r.data),
  getBubble: (id: string, x: string, y: string, size: string, color?: string, useCleaned = false) =>
    apiClient
      .get(`/api/datasets/${id}/eda/bubble`, {
        params: { x, y, size, color: color || undefined, use_cleaned: useCleaned },
      })
      .then((r) => r.data),
  getScatterMatrix: (id: string, columns: string[], useCleaned = false) =>
    apiClient
      .get(`/api/datasets/${id}/eda/scatter-matrix`, {
        params: { columns: columns.join(','), use_cleaned: useCleaned },
      })
      .then((r) => r.data),
  getBarChart: (id: string, column: string, topN = 15, useCleaned = false) =>
    apiClient
      .get(`/api/datasets/${id}/eda/barchart`, {
        params: { column, top_n: topN, use_cleaned: useCleaned },
      })
      .then((r) => r.data),
  getStackedBar: (id: string, primaryColumn: string, secondaryColumn: string, useCleaned = false) =>
    apiClient
      .get(`/api/datasets/${id}/eda/stacked-bar`, {
        params: { primary_column: primaryColumn, secondary_column: secondaryColumn, use_cleaned: useCleaned },
      })
      .then((r) => r.data),
  getTimeSeries: (id: string, dateColumn: string, valueColumn: string, useCleaned = false) =>
    apiClient
      .get(`/api/datasets/${id}/eda/timeseries`, {
        params: { date_column: dateColumn, value_column: valueColumn, use_cleaned: useCleaned },
      })
      .then((r) => r.data),
  getMissingChart: (id: string, useCleaned = false) =>
    apiClient
      .get(`/api/datasets/${id}/eda/missing`, {
        params: { use_cleaned: useCleaned },
      })
      .then((r) => r.data),
  getMissingMatrix: (id: string, useCleaned = false) =>
    apiClient
      .get(`/api/datasets/${id}/eda/missing-matrix`, {
        params: { use_cleaned: useCleaned },
      })
      .then((r) => r.data),
  getDistributionComparison: (id: string, columns: string[], useCleaned = false) =>
    apiClient
      .get(`/api/datasets/${id}/eda/distribution-comparison`, {
        params: { columns: columns.join(','), use_cleaned: useCleaned },
      })
      .then((r) => r.data),
};

// ML API
export const mlApi = {
  train: (datasetId: string, req: MLTrainRequest, useCleaned = false) =>
    apiClient
      .post<MLTrainResponse>(`/api/datasets/${datasetId}/train`, req, {
        params: { use_cleaned: useCleaned },
      })
      .then((r) => r.data),
  listModels: (datasetId: string) =>
    apiClient.get<any[]>(`/api/datasets/${datasetId}/models`).then((r) => r.data),
  getModel: (modelId: string) =>
    apiClient.get<any>(`/api/models/${modelId}`).then((r) => r.data),
  predictSingle: (modelId: string, features: Record<string, any>) =>
    apiClient
      .post<{ predictions: any[]; prediction_probabilities?: any[] }>(
        `/api/models/${modelId}/predict-single`,
        { features }
      )
      .then((r) => r.data),
  predictBatch: (modelId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient
      .post<{ prediction_job_id: string; total_rows: number; preview: any[]; download_url: string }>(
        `/api/models/${modelId}/predict-batch`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      )
      .then((r) => r.data);
  },
  downloadPredictions: (modelId: string, predJobId: string, filename = 'predictions.csv') =>
    downloadAuthenticatedBlob(`/api/models/${modelId}/predictions/${predJobId}/download`, filename),
};

// AI API
export const aiApi = {
  getHealth: () =>
    apiClient.get<AIHealthStatus>('/api/ai/health').then((r) => r.data),
  chat: (datasetId: string, message: string) =>
    apiClient
      .post<ChatMessage>(`/api/datasets/${datasetId}/chat`, { message })
      .then((r) => r.data),
  getHistory: (datasetId: string) =>
    apiClient.get<ChatMessage[]>(`/api/datasets/${datasetId}/chat/history`).then((r) => r.data),
  clearHistory: (datasetId: string) =>
    apiClient.delete(`/api/datasets/${datasetId}/chat/history`).then((r) => r.data),
};

// Reports API
export const reportsApi = {
  getPdfReportUrl: (datasetId: string) => `/api/datasets/${datasetId}/report/pdf`,
  downloadPdf: (datasetId: string, filename = 'DataPilot_Report.pdf') =>
    downloadAuthenticatedBlob(`/api/datasets/${datasetId}/report/pdf`, filename),
  downloadJson: (datasetId: string, filename = 'DataPilot_Profile.json') =>
    downloadAuthenticatedBlob(`/api/datasets/${datasetId}/export/json`, filename),
};
