import React, { useState, useEffect } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  Database,
  Trash2,
  Search,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Download,
} from 'lucide-react';
import { useDataset } from '../context/DatasetContext';
import { datasetsApi } from '../services/api';
import { DatasetPreview } from '../types';

export const DatasetsPage: React.FC = () => {
  const {
    datasets,
    selectedDataset,
    selectDatasetById,
    refreshDatasets,
    loadSampleDataset,
    useCleanedVersion,
  } = useDataset();

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [customName, setCustomName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  // Preview state
  const [preview, setPreview] = useState<DatasetPreview | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;

    setIsUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      const res = await datasetsApi.upload(uploadFile, customName || undefined);
      setUploadSuccess(`Dataset "${res.name}" uploaded and profiled successfully!`);
      setUploadFile(null);
      setCustomName('');
      await refreshDatasets();
      selectDatasetById(res.id);
    } catch (err: any) {
      setUploadError(err.response?.data?.detail || 'Failed to upload CSV file.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete dataset "${name}"?`)) return;
    try {
      await datasetsApi.delete(id);
      await refreshDatasets();
    } catch (err: any) {
      alert('Failed to delete dataset: ' + (err.response?.data?.detail || err.message));
    }
  };

  const fetchPreview = async () => {
    if (!selectedDataset) {
      setPreview(null);
      return;
    }
    setIsLoadingPreview(true);
    try {
      const data = await datasetsApi.getPreview(selectedDataset.id, page, 20, search, useCleanedVersion);
      setPreview(data);
    } catch (err) {
      console.error('Failed to load preview', err);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  useEffect(() => {
    fetchPreview();
  }, [selectedDataset?.id, page, search, useCleanedVersion]);

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">Dataset Management</h1>
          <p className="text-xs text-slate-400">
            Upload custom CSV files or explore pre-configured benchmark datasets.
          </p>
        </div>
      </div>

      {/* Upload and Sample Datasets Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* CSV File Upload Area */}
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 lg:col-span-2">
          <h3 className="text-sm font-bold text-slate-100 mb-4 flex items-center space-x-2">
            <UploadCloud className="w-4 h-4 text-indigo-400" />
            <span>Upload New CSV Dataset</span>
          </h3>

          {uploadError && (
            <div className="mb-4 p-3 rounded-xl bg-red-950/80 border border-red-800/80 text-xs text-red-200 flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{uploadError}</span>
            </div>
          )}

          {uploadSuccess && (
            <div className="mb-4 p-3 rounded-xl bg-teal-950/80 border border-teal-800/80 text-xs text-teal-200 flex items-start space-x-2">
              <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
              <span>{uploadSuccess}</span>
            </div>
          )}

          <form onSubmit={handleUpload} className="space-y-4">
            <div className="border-2 border-dashed border-slate-700/80 hover:border-indigo-500/60 rounded-2xl p-6 text-center transition bg-slate-950/40">
              <input
                type="file"
                accept=".csv"
                id="csv-file-input"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                className="hidden"
              />
              <label htmlFor="csv-file-input" className="cursor-pointer block">
                <FileSpreadsheet className="w-10 h-10 text-slate-500 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-200">
                  {uploadFile ? uploadFile.name : 'Click or Drag & Drop CSV file here'}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Supported format: .csv (Max 50MB)
                </p>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Dataset Name (Optional)</label>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="e.g. Q4 Sales Forecast"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="sm:self-end">
                <button
                  type="submit"
                  disabled={!uploadFile || isUploading}
                  className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-semibold text-xs transition shadow-sm"
                >
                  {isUploading ? 'Uploading & Profiling...' : 'Upload & Analyze CSV'}
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* 1-Click Sample Datasets Card */}
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-100 mb-1 flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-teal-400" />
              <span>Sample Benchmark Data</span>
            </h3>
            <p className="text-xs text-slate-400 mb-4">Instant 1-click loading for instant testing:</p>

            <div className="space-y-2.5">
              <button
                onClick={() => loadSampleDataset('churn')}
                className="w-full p-3 rounded-xl bg-slate-950/80 hover:bg-slate-850 border border-slate-800 hover:border-indigo-500/50 text-left transition flex items-center justify-between"
              >
                <div>
                  <span className="text-xs font-bold text-slate-200 block">Telecom Churn</span>
                  <span className="text-[10px] text-indigo-400">Classification Task • 750 rows</span>
                </div>
                <span className="text-[10px] px-2 py-1 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
                  Load
                </span>
              </button>

              <button
                onClick={() => loadSampleDataset('housing')}
                className="w-full p-3 rounded-xl bg-slate-950/80 hover:bg-slate-850 border border-slate-800 hover:border-teal-500/50 text-left transition flex items-center justify-between"
              >
                <div>
                  <span className="text-xs font-bold text-slate-200 block">Real Estate Housing</span>
                  <span className="text-[10px] text-teal-400">Regression Task • 600 rows</span>
                </div>
                <span className="text-[10px] px-2 py-1 rounded bg-teal-950 text-teal-300 border border-teal-800">
                  Load
                </span>
              </button>

              <button
                onClick={() => loadSampleDataset('segmentation')}
                className="w-full p-3 rounded-xl bg-slate-950/80 hover:bg-slate-850 border border-slate-800 hover:border-purple-500/50 text-left transition flex items-center justify-between"
              >
                <div>
                  <span className="text-xs font-bold text-slate-200 block">Customer Segments</span>
                  <span className="text-[10px] text-purple-400">Clustering Task • 500 rows</span>
                </div>
                <span className="text-[10px] px-2 py-1 rounded bg-purple-950 text-purple-300 border border-purple-800">
                  Load
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Uploaded Datasets List */}
      <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800">
        <h3 className="text-sm font-bold text-slate-100 mb-4 flex items-center space-x-2">
          <Database className="w-4 h-4 text-indigo-400" />
          <span>Uploaded Datasets ({datasets.length})</span>
        </h3>

        {datasets.length === 0 ? (
          <p className="text-xs text-slate-500 italic py-4 text-center">No datasets uploaded yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {datasets.map((d) => {
              const isSelected = selectedDataset?.id === d.id;
              return (
                <div
                  key={d.id}
                  onClick={() => selectDatasetById(d.id)}
                  className={`p-4 rounded-xl border transition cursor-pointer text-left ${
                    isSelected
                      ? 'bg-slate-850 border-indigo-500/80 shadow-md shadow-indigo-500/10 ring-1 ring-indigo-500/50'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="text-xs font-bold text-slate-200 truncate max-w-[180px]" title={d.name}>
                      {d.name}
                    </h4>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(d.id, d.name);
                      }}
                      className="text-slate-500 hover:text-red-400 p-1 rounded hover:bg-slate-800 transition"
                      title="Delete Dataset"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="text-[11px] text-slate-400 space-y-1">
                    <p>{d.row_count.toLocaleString()} rows • {d.column_count} columns</p>
                    <p className="text-[10px] text-slate-500 font-mono">
                      File: {d.original_filename} ({(d.file_size_bytes / 1024).toFixed(1)} KB)
                    </p>
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-teal-400">
                      Score: {Math.round(d.quality_score)}/100
                    </span>
                    <a
                      href={datasetsApi.getDownloadUrl(d.id)}
                      onClick={(e) => e.stopPropagation()}
                      download
                      className="text-slate-400 hover:text-slate-200 flex items-center space-x-1"
                      title="Download Original CSV"
                    >
                      <Download className="w-3 h-3" />
                      <span>CSV</span>
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Paginated Data Preview Table */}
      {selectedDataset && (
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                <FileSpreadsheet className="w-4 h-4 text-teal-400" />
                <span>Data Table Preview: {selectedDataset.name}</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Showing rows {((page - 1) * 20) + 1} - {Math.min(page * 20, preview?.total_rows || 0)} of{' '}
                {preview?.total_rows.toLocaleString()}
              </p>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search rows..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/40">
            {isLoadingPreview ? (
              <div className="py-12 text-center text-xs text-slate-400">Loading table rows...</div>
            ) : preview?.preview_rows && preview.preview_rows.length > 0 ? (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 text-[10px] font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3">#</th>
                    {preview.columns.map((col) => (
                      <th key={col} className="py-2.5 px-3">
                        <div className="flex flex-col">
                          <span className="text-slate-200 font-mono">{col}</span>
                          <span className="text-[9px] text-slate-500 lowercase">
                            {preview.dtypes[col] || 'text'}
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                  {preview.preview_rows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/30 transition">
                      <td className="py-2 px-3 text-slate-600">
                        {((page - 1) * 20) + idx + 1}
                      </td>
                      {preview.columns.map((col) => {
                        const val = row[col];
                        return (
                          <td key={col} className="py-2 px-3 text-slate-300 max-w-[200px] truncate">
                            {val === null || val === undefined ? (
                              <span className="text-amber-500/80 italic text-[10px]">null</span>
                            ) : (
                              String(val)
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="py-12 text-center text-xs text-slate-500">No rows matching query.</div>
            )}
          </div>

          {/* Pagination Controls */}
          {preview && preview.total_pages > 1 && (
            <div className="flex items-center justify-between pt-2 text-xs">
              <span className="text-slate-400">
                Page {page} of {preview.total_pages}
              </span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="p-1.5 rounded-lg border border-slate-700 bg-slate-900 disabled:opacity-40 text-slate-300 hover:text-white"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(preview.total_pages, p + 1))}
                  disabled={page >= preview.total_pages}
                  className="p-1.5 rounded-lg border border-slate-700 bg-slate-900 disabled:opacity-40 text-slate-300 hover:text-white"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
