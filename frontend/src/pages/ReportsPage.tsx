import React, { useState } from 'react';
import {
  FileCheck2,
  Download,
  FileSpreadsheet,
  Cpu,
  Code,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { useDataset } from '../context/DatasetContext';
import { datasetsApi, reportsApi } from '../services/api';

export const ReportsPage: React.FC = () => {
  const { selectedDataset, profile } = useDataset();

  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isDownloadingCleaned, setIsDownloadingCleaned] = useState(false);
  const [isDownloadingRaw, setIsDownloadingRaw] = useState(false);
  const [isDownloadingJson, setIsDownloadingJson] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!selectedDataset) {
    return <div className="p-8 text-center text-slate-400">Please select a dataset first.</div>;
  }

  const handleDownloadPdf = async () => {
    setIsDownloadingPdf(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await reportsApi.downloadPdf(selectedDataset.id, `DataPilot_Report_${selectedDataset.name}.pdf`);
      setSuccessMessage('Executive PDF Report downloaded successfully.');
    } catch (err: any) {
      setErrorMessage(err.response?.data?.detail || 'Failed to download Executive PDF Report.');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleDownloadCleanedCsv = async () => {
    setIsDownloadingCleaned(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await datasetsApi.downloadCsv(selectedDataset.id, 'cleaned', `cleaned_${selectedDataset.name}.csv`);
      setSuccessMessage('Cleaned dataset CSV downloaded successfully.');
    } catch (err: any) {
      setErrorMessage(err.response?.data?.detail || 'Failed to download cleaned CSV.');
    } finally {
      setIsDownloadingCleaned(false);
    }
  };

  const handleDownloadRawCsv = async () => {
    setIsDownloadingRaw(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await datasetsApi.downloadCsv(selectedDataset.id, 'original', `raw_${selectedDataset.name}.csv`);
      setSuccessMessage('Original raw CSV downloaded successfully.');
    } catch (err: any) {
      setErrorMessage(err.response?.data?.detail || 'Failed to download raw CSV.');
    } finally {
      setIsDownloadingRaw(false);
    }
  };

  const handleExportJson = async () => {
    setIsDownloadingJson(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await reportsApi.downloadJson(selectedDataset.id, `DataPilot_Profile_${selectedDataset.name}.json`);
      setSuccessMessage('JSON Profiling export downloaded successfully.');
    } catch (err: any) {
      setErrorMessage(err.response?.data?.detail || 'Failed to export JSON profiling data.');
    } finally {
      setIsDownloadingJson(false);
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-7 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">
            Reports &amp; Export Center
          </h1>
          <p className="text-xs text-slate-400">
            Export production-ready executive PDF analytics reports, cleaned CSV artifacts, and structured JSON metadata.
          </p>
        </div>
      </div>

      {/* Notifications */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-950/80 border border-red-800 text-xs text-red-200 flex items-start space-x-2">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}
      {successMessage && (
        <div className="p-4 rounded-xl bg-teal-950/80 border border-teal-800 text-xs text-teal-200 flex items-start space-x-2">
          <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Main Download Options Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Executive PDF Report Card */}
        <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-950/60 via-slate-900 to-slate-950 border border-indigo-500/40 flex flex-col justify-between space-y-6 shadow-sm">
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-100">Executive PDF Analytics Report</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              A comprehensive multi-page executive document containing data quality breakdown, descriptive statistics tables, column schemas, cleaning audit trail, and ML model evaluation metrics.
            </p>

            <ul className="space-y-1.5 text-xs text-slate-300 pt-2">
              <li className="flex items-center space-x-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
                <span>Executive Summary &amp; Data Quality Grade</span>
              </li>
              <li className="flex items-center space-x-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
                <span>Full Descriptive Statistics Breakdown</span>
              </li>
              <li className="flex items-center space-x-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
                <span>Audit Trail of Applied Data Cleaning</span>
              </li>
              <li className="flex items-center space-x-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
                <span>Machine Learning Evaluation Summaries</span>
              </li>
            </ul>
          </div>

          <button
            onClick={handleDownloadPdf}
            disabled={isDownloadingPdf}
            className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition flex items-center justify-center space-x-2"
          >
            {isDownloadingPdf ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Generating Executive PDF...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Download Executive PDF Report</span>
              </>
            )}
          </button>
        </div>

        {/* Cleaned Dataset CSV Export */}
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between space-y-6 shadow-sm">
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-teal-600/20 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-100">Cleaned Dataset Artifact (CSV)</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Export the transformed, deduplicated, and imputed dataset ready for downstream production databases or BI dashboards.
            </p>

            {selectedDataset.has_cleaned_version ? (
              <div className="p-3 rounded-xl bg-teal-950/60 border border-teal-800 text-xs text-teal-300 flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-teal-400 shrink-0" />
                <span>Cleaned version available ({selectedDataset.row_count.toLocaleString()} rows)</span>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-500 italic">
                No cleaned version created yet. Apply transformations in the Cleaning Studio.
              </div>
            )}
          </div>

          <button
            onClick={handleDownloadCleanedCsv}
            disabled={!selectedDataset.has_cleaned_version || isDownloadingCleaned}
            className="w-full py-3 px-4 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold text-xs shadow-lg shadow-teal-600/20 transition flex items-center justify-center space-x-2"
          >
            {isDownloadingCleaned ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Downloading Cleaned CSV...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Download Cleaned CSV Artifact</span>
              </>
            )}
          </button>
        </div>

        {/* Original Raw Dataset CSV Export */}
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between space-y-4 shadow-sm">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-slate-700/30 border border-slate-700 flex items-center justify-center text-slate-300">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-100">Original Raw Dataset (CSV)</h3>
            <p className="text-xs text-slate-400">
              Download the original, unmutated CSV file exactly as uploaded.
            </p>
          </div>

          <button
            onClick={handleDownloadRawCsv}
            disabled={isDownloadingRaw}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 font-semibold text-xs border border-slate-700 transition flex items-center justify-center space-x-2"
          >
            {isDownloadingRaw ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Downloading Raw CSV...</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>Download Raw CSV</span>
              </>
            )}
          </button>
        </div>

        {/* JSON Metadata & Summary Export */}
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between space-y-4 shadow-sm">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Code className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-100">JSON Profiling Payload</h3>
            <p className="text-xs text-slate-400">
              Machine-readable structured UTF-8 JSON payload of full profiling stats, correlations, and quality scores.
            </p>
          </div>

          <button
            onClick={handleExportJson}
            disabled={isDownloadingJson}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 font-semibold text-xs border border-slate-700 transition flex items-center justify-center space-x-2"
          >
            {isDownloadingJson ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Exporting JSON...</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>Export Profile JSON</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
