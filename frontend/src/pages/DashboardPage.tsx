import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  FileSpreadsheet,
  BarChart3,
  Cpu,
  Bot,
  FileCheck2,
  ArrowRight,
  Database,
  CheckCircle,
  Copy,
  Layers,
  Activity,
  Zap,
} from 'lucide-react';
import { useDataset } from '../context/DatasetContext';

export const DashboardPage: React.FC = () => {
  const {
    selectedDataset,
    profile,
    isLoadingDatasets,
    isLoadingProfile,
    loadSampleDataset,
    useCleanedVersion,
  } = useDataset();
  const navigate = useNavigate();
  const [loadingSample, setLoadingSample] = useState(false);

  const handleQuickSample = async (type: 'churn' | 'housing' | 'segmentation') => {
    setLoadingSample(true);
    try {
      await loadSampleDataset(type);
    } finally {
      setLoadingSample(false);
    }
  };

  if (isLoadingDatasets || isLoadingProfile) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-10 h-10 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
        <p className="text-xs text-slate-400 font-medium">Analyzing dataset &amp; computing profile metrics...</p>
      </div>
    );
  }

  if (!selectedDataset) {
    return (
      <div className="p-8 max-w-4xl mx-auto text-center py-16">
        <div className="w-16 h-16 rounded-2xl bg-indigo-950/80 border border-indigo-800/80 flex items-center justify-center text-indigo-400 mx-auto mb-4">
          <Database className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-slate-100 mb-2">No Active Dataset Selected</h2>
        <p className="text-xs text-slate-400 max-w-md mx-auto mb-8">
          Upload your own CSV dataset or load one of our curated sample datasets to start automated profiling, data cleaning, and machine learning.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 text-left">
          <button
            onClick={() => handleQuickSample('churn')}
            disabled={loadingSample}
            className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-indigo-500/60 transition group"
          >
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800 mb-2 inline-block">
              Classification
            </span>
            <h4 className="text-sm font-bold text-slate-200">Customer Churn</h4>
            <p className="text-xs text-slate-400 mt-1">750 rows • Telecom subscriber contract &amp; payment data</p>
          </button>

          <button
            onClick={() => handleQuickSample('housing')}
            disabled={loadingSample}
            className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-teal-500/60 transition group"
          >
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-teal-950 text-teal-300 border border-teal-800 mb-2 inline-block">
              Regression
            </span>
            <h4 className="text-sm font-bold text-slate-200">Real Estate Pricing</h4>
            <p className="text-xs text-slate-400 mt-1">600 rows • Housing attributes, square footage &amp; price</p>
          </button>

          <button
            onClick={() => handleQuickSample('segmentation')}
            disabled={loadingSample}
            className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-purple-500/60 transition group"
          >
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800 mb-2 inline-block">
              Clustering
            </span>
            <h4 className="text-sm font-bold text-slate-200">Customer Segments</h4>
            <p className="text-xs text-slate-400 mt-1">500 rows • Customer age, annual income &amp; spend score</p>
          </button>
        </div>

        <button
          onClick={() => navigate('/datasets')}
          className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition inline-flex items-center space-x-2"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Upload Custom CSV Dataset</span>
        </button>
      </div>
    );
  }

  const quality = profile?.quality;
  const score = quality?.overall_score || Math.round(selectedDataset.quality_score);
  const grade = quality?.grade || (score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F');

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Top Banner: Dataset Overview */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
        <div>
          <div className="flex items-center space-x-2.5 mb-1">
            <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">
              {selectedDataset.name}
            </h1>
            {useCleanedVersion && (
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-teal-950 text-teal-300 border border-teal-800 flex items-center space-x-1">
                <ShieldCheck className="w-3 h-3" />
                <span>Cleaned Version Active</span>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400">
            Source file: <span className="font-mono text-slate-300">{selectedDataset.original_filename}</span> •
            Uploaded on {new Date(selectedDataset.created_at).toLocaleDateString()}
          </p>
        </div>

        {/* Action Shortcuts */}
        <div className="flex items-center flex-wrap gap-2.5">
          <button
            onClick={() => navigate('/cleaning')}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition flex items-center space-x-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Clean Data</span>
          </button>
          <button
            onClick={() => navigate('/eda')}
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-semibold border border-slate-700/80 transition flex items-center space-x-1.5"
          >
            <BarChart3 className="w-3.5 h-3.5 text-indigo-400" />
            <span>Explore Charts</span>
          </button>
          <button
            onClick={() => navigate('/ml')}
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-semibold border border-slate-700/80 transition flex items-center space-x-1.5"
          >
            <Cpu className="w-3.5 h-3.5 text-purple-400" />
            <span>Train ML</span>
          </button>
          <button
            onClick={() => navigate('/ai')}
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-semibold border border-slate-700/80 transition flex items-center space-x-1.5"
          >
            <Bot className="w-3.5 h-3.5 text-teal-400" />
            <span>Ask Gemini</span>
          </button>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
          <span className="text-[11px] font-medium text-slate-400 block mb-1">Total Rows</span>
          <span className="text-xl font-bold text-slate-100 font-mono">
            {profile?.row_count?.toLocaleString() ?? selectedDataset.row_count.toLocaleString()}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
          <span className="text-[11px] font-medium text-slate-400 block mb-1">Total Columns</span>
          <span className="text-xl font-bold text-slate-100 font-mono">
            {profile?.column_count ?? selectedDataset.column_count}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
          <span className="text-[11px] font-medium text-slate-400 block mb-1">Memory Size</span>
          <span className="text-xl font-bold text-slate-100 font-mono">
            {profile?.memory_usage_mb ? `${profile.memory_usage_mb} MB` : `${(selectedDataset.file_size_bytes / 1024).toFixed(1)} KB`}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
          <span className="text-[11px] font-medium text-slate-400 block mb-1">Missing Cells</span>
          <span className="text-xl font-bold text-amber-400 font-mono">
            {profile ? `${profile.missing_cells_percentage}%` : '0%'}
          </span>
          <span className="text-[10px] text-slate-500 block mt-0.5">
            {profile?.missing_cells_count ? `${profile.missing_cells_count.toLocaleString()} cells` : 'No missing'}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
          <span className="text-[11px] font-medium text-slate-400 block mb-1">Duplicate Rows</span>
          <span className="text-xl font-bold text-indigo-400 font-mono">
            {profile ? `${profile.duplicate_rows_count}` : '0'}
          </span>
          <span className="text-[10px] text-slate-500 block mt-0.5">
            {profile?.duplicate_rows_percentage ? `${profile.duplicate_rows_percentage}% dupes` : 'Zero duplicates'}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
          <span className="text-[11px] font-medium text-slate-400 block mb-1">Numeric / Cat</span>
          <span className="text-xl font-bold text-teal-400 font-mono">
            {profile ? `${profile.numeric_columns_count} / ${profile.categorical_columns_count}` : '-'}
          </span>
          <span className="text-[10px] text-slate-500 block mt-0.5">Attribute types</span>
        </div>
      </div>

      {/* Main Grid: Quality Score Card & Health Audit */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quality Score Breakdown Card */}
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-teal-400" />
                <span>Data Health &amp; Quality</span>
              </h3>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                grade === 'A' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
                grade === 'B' ? 'bg-teal-950 text-teal-300 border border-teal-800' :
                grade === 'C' ? 'bg-amber-950 text-amber-300 border border-amber-800' :
                'bg-red-950 text-red-300 border border-red-800'
              }`}>
                Grade {grade}
              </span>
            </div>

            <div className="text-center py-4 my-2 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <span className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-teal-400 via-emerald-300 to-indigo-300 font-mono">
                {score}
              </span>
              <span className="text-xs text-slate-400 block mt-1 font-medium">out of 100 points</span>
            </div>

            <div className="space-y-3 mt-4 text-xs">
              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Completeness</span>
                  <span className="font-mono">{quality?.completeness_score ?? 100}%</span>
                </div>
                <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-teal-500 rounded-full"
                    style={{ width: `${quality?.completeness_score ?? 100}%` }}
                  ></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Uniqueness</span>
                  <span className="font-mono">{quality?.uniqueness_score ?? 100}%</span>
                </div>
                <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded-full"
                    style={{ width: `${quality?.uniqueness_score ?? 100}%` }}
                  ></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Validity &amp; Outliers</span>
                  <span className="font-mono">{quality?.validity_score ?? 100}%</span>
                </div>
                <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-500 rounded-full"
                    style={{ width: `${quality?.validity_score ?? 100}%` }}
                  ></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Schema Consistency</span>
                  <span className="font-mono">{quality?.consistency_score ?? 100}%</span>
                </div>
                <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{ width: `${quality?.consistency_score ?? 100}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800 text-[11px] text-slate-400">
            Weighted composite: Completeness (35%), Uniqueness (25%), Validity (20%), Schema (20%).
          </div>
        </div>

        {/* Findings, Outliers & Correlation Alerts */}
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 lg:col-span-2 space-y-6">
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2 mb-3">
              <Activity className="w-4 h-4 text-indigo-400" />
              <span>Automated Health Insights &amp; Findings</span>
            </h3>
            <div className="space-y-2">
              {quality?.breakdown_notes && quality.breakdown_notes.length > 0 ? (
                quality.breakdown_notes.map((note, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs text-slate-300 flex items-start space-x-2.5"
                  >
                    <CheckCircle className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                    <span>{note}</span>
                  </div>
                ))
              ) : (
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-400">
                  Dataset is clean and well-formed.
                </div>
              )}
            </div>
          </div>

          {/* High Correlations Section */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Notable Linear Correlations (|r| ≥ 0.80)
            </h4>
            {profile?.highly_correlated_pairs && profile.highly_correlated_pairs.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {profile.highly_correlated_pairs.slice(0, 4).map((p, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <span className="font-medium text-slate-300 truncate max-w-[150px]">
                      {p.column_1} ↔ {p.column_2}
                    </span>
                    <span className="font-mono text-teal-400 font-bold">r = {p.correlation}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">No collinear pairs (|r| ≥ 0.80) detected.</p>
            )}
          </div>
        </div>
      </div>

      {/* Schema Attributes Breakdown Table */}
      <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
            <Layers className="w-4 h-4 text-indigo-400" />
            <span>Dataset Schema &amp; Attribute Profiling</span>
          </h3>
          <button
            onClick={() => navigate('/eda')}
            className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center space-x-1"
          >
            <span>Open in EDA</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                <th className="pb-3 pr-4">Column Name</th>
                <th className="pb-3 px-4">Semantic Type</th>
                <th className="pb-3 px-4">Missing Values</th>
                <th className="pb-3 px-4">Unique Values</th>
                <th className="pb-3 px-4">Statistical Summary / Top Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {profile?.columns?.slice(0, 10).map((col) => (
                <tr key={col.name} className="hover:bg-slate-800/30 transition">
                  <td className="py-3 pr-4 font-mono font-medium text-slate-200">{col.name}</td>
                  <td className="py-3 px-4">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      col.inferred_type === 'numeric' ? 'bg-blue-950 text-blue-300 border border-blue-800' :
                      col.inferred_type === 'categorical' ? 'bg-purple-950 text-purple-300 border border-purple-800' :
                      col.inferred_type === 'datetime' ? 'bg-teal-950 text-teal-300 border border-teal-800' :
                      'bg-slate-800 text-slate-300'
                    }`}>
                      {col.inferred_type}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={col.missing_count > 0 ? 'text-amber-400 font-medium' : 'text-slate-400'}>
                      {col.missing_count} ({col.missing_percentage}%)
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-300">{col.unique_count.toLocaleString()}</td>
                  <td className="py-3 px-4 text-slate-400">
                    {col.stats ? (
                      <span className="font-mono text-[11px]">
                        mean: {col.stats.mean} | min: {col.stats.min} | max: {col.stats.max}
                        {col.stats.outlier_count > 0 && (
                          <span className="text-amber-400 ml-2">({col.stats.outlier_count} outliers)</span>
                        )}
                      </span>
                    ) : col.top_categories && col.top_categories.length > 0 ? (
                      <span>
                        Top: <span className="text-slate-200">"{col.top_categories[0].value}"</span> ({col.top_categories[0].percentage}%)
                      </span>
                    ) : (
                      '-'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
