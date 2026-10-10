import React, { useState, useEffect } from 'react';
import Plot from 'react-plotly.js';
import {
  Cpu,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Play,
  Download,
  Layers,
  BarChart,
  Zap,
  Sliders,
  Table,
  UploadCloud,
  FileSpreadsheet,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { useDataset } from '../context/DatasetContext';
import { mlApi } from '../services/api';
import { MLTrainResponse } from '../types';

export const MLPage: React.FC = () => {
  const { selectedDataset, profile, useCleanedVersion } = useDataset();

  const [taskType, setTaskType] = useState<'classification' | 'regression' | 'clustering'>('classification');
  const [targetCol, setTargetCol] = useState<string>('');
  const [featureCols, setFeatureCols] = useState<string[]>([]);
  const [modelName, setModelName] = useState<string>('RandomForestClassifier');
  const [testSize, setTestSize] = useState<number>(0.2);
  const [chronologicalSplit, setChronologicalSplit] = useState<boolean>(false);
  const [nClusters, setNClusters] = useState<number>(3);
  const [dbscanEps, setDbscanEps] = useState<number>(0.5);
  const [dbscanMinSamples, setDbscanMinSamples] = useState<number>(5);

  // Model training state
  const [isTraining, setIsTraining] = useState(false);
  const [trainedResult, setTrainedResult] = useState<MLTrainResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Single inference simulator state
  const [singleInputs, setSingleInputs] = useState<Record<string, any>>({});
  const [singlePredResult, setSinglePredResult] = useState<any>(null);
  const [isPredictingSingle, setIsPredictingSingle] = useState(false);

  // Batch inference state
  const [batchFile, setBatchFile] = useState<File | null>(null);
  const [batchResult, setBatchResult] = useState<any>(null);
  const [isPredictingBatch, setIsPredictingBatch] = useState(false);
  const [isDownloadingBatch, setIsDownloadingBatch] = useState(false);

  const allColumns = profile?.columns?.map((c) => c.name) || [];
  const numericColumns = profile?.columns?.filter((c) => c.inferred_type === 'numeric').map((c) => c.name) || [];

  // Auto-detect task type based on target column type
  useEffect(() => {
    if (targetCol && profile?.columns) {
      const targetMeta = profile.columns.find((c) => c.name === targetCol);
      if (targetMeta) {
        if (targetMeta.inferred_type === 'numeric' && targetMeta.unique_count > 15) {
          if (taskType === 'classification') {
            setTaskType('regression');
            setModelName('RandomForestRegressor');
          }
        } else if (['categorical', 'boolean', 'text'].includes(targetMeta.inferred_type) || targetMeta.unique_count <= 15) {
          if (taskType === 'regression') {
            setTaskType('classification');
            setModelName('RandomForestClassifier');
          }
        }
      }
    }
  }, [targetCol, profile]);

  const handleTaskChange = (type: 'classification' | 'regression' | 'clustering') => {
    setTaskType(type);
    setTrainedResult(null);
    setErrorMessage(null);
    if (type === 'classification') {
      setModelName('RandomForestClassifier');
      const defTarget = allColumns.find((c) => c.toLowerCase().includes('churn') || c.toLowerCase().includes('target') || c.toLowerCase().includes('label')) || allColumns[allColumns.length - 1] || '';
      setTargetCol(defTarget);
      setFeatureCols(allColumns.filter((c) => c !== defTarget));
    } else if (type === 'regression') {
      setModelName('RandomForestRegressor');
      const defTarget = numericColumns.find((c) => c.toLowerCase().includes('price') || c.toLowerCase().includes('consumption') || c.toLowerCase().includes('sales')) || numericColumns[numericColumns.length - 1] || '';
      setTargetCol(defTarget);
      setFeatureCols(allColumns.filter((c) => c !== defTarget));
    } else {
      setModelName('KMeans');
      setTargetCol('');
      setFeatureCols(numericColumns.slice(0, 4));
    }
  };

  const handleToggleFeature = (col: string) => {
    if (featureCols.includes(col)) {
      setFeatureCols(featureCols.filter((c) => c !== col));
    } else {
      setFeatureCols([...featureCols, col]);
    }
  };

  const handleSelectAllFeatures = () => {
    const available = allColumns.filter((c) => c !== targetCol);
    setFeatureCols(available);
  };

  const handleTrain = async () => {
    if (!selectedDataset) return;
    if (featureCols.length === 0) {
      setErrorMessage('Please select at least one feature column.');
      return;
    }
    if (taskType !== 'clustering' && !targetCol) {
      setErrorMessage('Please select a target column.');
      return;
    }

    setIsTraining(true);
    setErrorMessage(null);
    setTrainedResult(null);
    setSinglePredResult(null);
    setBatchResult(null);

    try {
      const res = await mlApi.train(
        selectedDataset.id,
        {
          task_type: taskType,
          target_column: taskType !== 'clustering' ? targetCol : undefined,
          feature_columns: featureCols,
          model_name: modelName,
          test_size: testSize,
          chronological_split: chronologicalSplit,
          random_state: 42,
          n_clusters: taskType === 'clustering' && modelName === 'KMeans' ? nClusters : undefined,
          eps: taskType === 'clustering' && modelName === 'DBSCAN' ? dbscanEps : undefined,
          min_samples: taskType === 'clustering' && modelName === 'DBSCAN' ? dbscanMinSamples : undefined,
        },
        useCleanedVersion
      );
      setTrainedResult(res);

      // Pre-fill single input defaults
      const defaults: Record<string, any> = {};
      res.feature_columns.forEach((col) => {
        const colMeta = profile?.columns?.find((c) => c.name === col);
        if (colMeta?.stats) {
          defaults[col] = colMeta.stats.median;
        } else if (colMeta?.top_categories && colMeta.top_categories.length > 0) {
          defaults[col] = colMeta.top_categories[0].value;
        } else {
          defaults[col] = '';
        }
      });
      setSingleInputs(defaults);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.detail || 'Model training failed.');
    } finally {
      setIsTraining(false);
    }
  };

  const handleRunSinglePredict = async () => {
    if (!trainedResult) return;
    setIsPredictingSingle(true);
    try {
      const res = await mlApi.predictSingle(trainedResult.model_run_id, singleInputs);
      setSinglePredResult(res);
    } catch (err: any) {
      alert('Prediction failed: ' + (err.response?.data?.detail || err.message));
    } finally {
      setIsPredictingSingle(false);
    }
  };

  const handleRunBatchPredict = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trainedResult || !batchFile) return;
    setIsPredictingBatch(true);
    try {
      const res = await mlApi.predictBatch(trainedResult.model_run_id, batchFile);
      setBatchResult(res);
    } catch (err: any) {
      alert('Batch prediction failed: ' + (err.response?.data?.detail || err.message));
    } finally {
      setIsPredictingBatch(false);
    }
  };

  const handleDownloadBatch = async () => {
    if (!trainedResult || !batchResult) return;
    setIsDownloadingBatch(true);
    try {
      await mlApi.downloadPredictions(
        trainedResult.model_run_id,
        batchResult.prediction_job_id,
        `predictions_${trainedResult.model_name}.csv`
      );
    } catch (err: any) {
      alert('Failed to download batch predictions: ' + (err.response?.data?.detail || err.message));
    } finally {
      setIsDownloadingBatch(false);
    }
  };

  if (!selectedDataset) {
    return <div className="p-8 text-center text-slate-400">Please select a dataset first.</div>;
  }

  return (
    <div className="p-6 md:p-8 space-y-7 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
        <div>
          <div className="flex items-center space-x-2.5 mb-1">
            <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">
              Machine Learning Lab
            </h1>
            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800">
              {selectedDataset.name}
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Train scikit-learn models with ColumnTransformer preprocessors, baseline comparisons, and live prediction tooling.
          </p>
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-950/80 border border-red-800 text-xs text-red-200 flex items-start space-x-2">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Task Type Switcher */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { id: 'classification', title: '1. Classification', desc: 'Predict discrete categories & classes (e.g. Churn, Fraud)' },
          { id: 'regression', title: '2. Regression', desc: 'Forecast continuous numeric values (e.g. Price, Consumption)' },
          { id: 'clustering', title: '3. Clustering', desc: 'Discover natural unsupervised groupings (e.g. Customer Segments)' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => handleTaskChange(t.id as any)}
            className={`p-4 rounded-2xl border text-left transition ${
              taskType === t.id
                ? 'bg-indigo-950/70 border-indigo-500 shadow-md ring-1 ring-indigo-500/50 text-white'
                : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-850'
            }`}
          >
            <h4 className="text-xs font-bold">{t.title}</h4>
            <p className="text-[11px] mt-1 text-slate-400">{t.desc}</p>
          </button>
        ))}
      </div>

      {/* Wizard Configuration Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Configuration Form (5 cols) */}
        <div className="lg:col-span-5 p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-5">
          <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
            <Sliders className="w-4 h-4 text-indigo-400" />
            <span>Training Configuration</span>
          </h3>

          {/* Target Column Selector */}
          {taskType !== 'clustering' && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Target Column (Output Variable)
              </label>
              <select
                value={targetCol}
                onChange={(e) => {
                  setTargetCol(e.target.value);
                  setFeatureCols(featureCols.filter((c) => c !== e.target.value));
                }}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-200 font-mono"
              >
                <option value="">-- Select Target Column --</option>
                {allColumns.map((col) => (
                  <option key={col} value={col}>{col}</option>
                ))}
              </select>
            </div>
          )}

          {/* Model Algorithm */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Algorithm</label>
            <select
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-200"
            >
              {taskType === 'classification' && (
                <>
                  <option value="RandomForestClassifier">Random Forest Classifier (Ensemble Trees)</option>
                  <option value="GradientBoostingClassifier">Gradient Boosting Classifier (Iterative Trees)</option>
                  <option value="DecisionTreeClassifier">Decision Tree Classifier (Single Tree)</option>
                  <option value="LogisticRegression">Logistic Regression (Linear Baseline)</option>
                </>
              )}
              {taskType === 'regression' && (
                <>
                  <option value="RandomForestRegressor">Random Forest Regressor (Ensemble)</option>
                  <option value="GradientBoostingRegressor">Gradient Boosting Regressor</option>
                  <option value="DecisionTreeRegressor">Decision Tree Regressor</option>
                  <option value="LinearRegression">Linear Regression (OLS)</option>
                  <option value="Ridge">Ridge Regression (L2 Regularized)</option>
                </>
              )}
              {taskType === 'clustering' && (
                <>
                  <option value="KMeans">K-Means Clustering</option>
                  <option value="DBSCAN">DBSCAN (Density-Based Spatial Clustering)</option>
                </>
              )}
            </select>
          </div>

          {/* Sliders / Hyperparams */}
          {taskType === 'clustering' ? (
            modelName === 'KMeans' ? (
              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1">
                  <span>Number of Clusters (K)</span>
                  <span className="font-mono text-teal-400 font-bold">{nClusters}</span>
                </div>
                <input
                  type="range"
                  min={2}
                  max={8}
                  value={nClusters}
                  onChange={(e) => setNClusters(parseInt(e.target.value))}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-slate-300 mb-1">Epsilon (eps: {dbscanEps})</label>
                  <input
                    type="range"
                    min={0.1}
                    max={2.0}
                    step={0.1}
                    value={dbscanEps}
                    onChange={(e) => setDbscanEps(parseFloat(e.target.value))}
                    className="w-full accent-indigo-500 cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">Min Samples ({dbscanMinSamples})</label>
                  <input
                    type="range"
                    min={2}
                    max={20}
                    value={dbscanMinSamples}
                    onChange={(e) => setDbscanMinSamples(parseInt(e.target.value))}
                    className="w-full accent-indigo-500 cursor-pointer"
                  />
                </div>
              </div>
            )
          ) : (
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1">
                  <span>Holdout Test Split</span>
                  <span className="font-mono text-indigo-400 font-bold">{Math.round(testSize * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0.1}
                  max={0.4}
                  step={0.05}
                  value={testSize}
                  onChange={(e) => setTestSize(parseFloat(e.target.value))}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="chronoSplit"
                  checked={chronologicalSplit}
                  onChange={(e) => setChronologicalSplit(e.target.checked)}
                  className="rounded accent-indigo-500"
                />
                <label htmlFor="chronoSplit" className="text-xs text-slate-300 cursor-pointer">
                  Chronological Split (Recommended for Time-Series / Ordered data)
                </label>
              </div>
            </div>
          )}

          {/* Feature Columns Checklist */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-300">
                Input Features ({featureCols.length} selected)
              </label>
              <button
                type="button"
                onClick={handleSelectAllFeatures}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium"
              >
                Select All
              </button>
            </div>

            <div className="max-h-48 overflow-y-auto space-y-1.5 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              {allColumns
                .filter((c) => c !== targetCol)
                .map((col) => {
                  const isChecked = featureCols.includes(col);
                  return (
                    <label
                      key={col}
                      className="flex items-center space-x-2 text-xs text-slate-300 hover:text-white cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleFeature(col)}
                        className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-0"
                      />
                      <span className="font-mono">{col}</span>
                    </label>
                  );
                })}
            </div>
          </div>

          <button
            onClick={handleTrain}
            disabled={isTraining}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition flex items-center justify-center space-x-2"
          >
            {isTraining ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                <span>Fitting Scikit-Learn Pipeline...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white" />
                <span>Train Model &amp; Evaluate</span>
              </>
            )}
          </button>
        </div>

        {/* Right: Evaluation Studio & Prediction Simulator (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {trainedResult ? (
            <div className="space-y-6">
              {/* Warnings / Leakage Alerts */}
              {trainedResult.warnings && trainedResult.warnings.length > 0 && (
                <div className="p-4 rounded-xl bg-amber-950/60 border border-amber-800/80 text-xs text-amber-200 space-y-1">
                  <div className="flex items-center space-x-2 font-bold text-amber-300">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Model Validation Advisory</span>
                  </div>
                  {trainedResult.warnings.map((w, i) => (
                    <p key={i}>• {w}</p>
                  ))}
                </div>
              )}

              {/* Performance Metrics Cards */}
              <div className="p-6 rounded-2xl bg-slate-900/90 border border-indigo-500/40 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-teal-400" />
                    <span>Model Results: {trainedResult.model_name}</span>
                  </h3>
                  <span className="text-[10px] uppercase font-mono px-2.5 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800">
                    {trainedResult.task_type}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  {trainedResult.task_type === 'classification' && (
                    <>
                      <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
                        <span className="text-[10px] text-slate-400 uppercase">Accuracy</span>
                        <p className="text-lg font-bold text-teal-400 font-mono mt-0.5">
                          {(trainedResult.metrics.accuracy * 100).toFixed(1)}%
                        </p>
                        <span className="text-[10px] text-slate-500 block">
                          Baseline: {(trainedResult.metrics.baseline_accuracy * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
                        <span className="text-[10px] text-slate-400 uppercase">F1-Score</span>
                        <p className="text-lg font-bold text-indigo-400 font-mono mt-0.5">
                          {trainedResult.metrics.f1_score}
                        </p>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
                        <span className="text-[10px] text-slate-400 uppercase">Precision</span>
                        <p className="text-lg font-bold text-purple-400 font-mono mt-0.5">
                          {trainedResult.metrics.precision}
                        </p>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
                        <span className="text-[10px] text-slate-400 uppercase">Recall</span>
                        <p className="text-lg font-bold text-blue-400 font-mono mt-0.5">
                          {trainedResult.metrics.recall}
                        </p>
                      </div>
                    </>
                  )}

                  {trainedResult.task_type === 'regression' && (
                    <>
                      <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
                        <span className="text-[10px] text-slate-400 uppercase">R² Score</span>
                        <p className={`text-lg font-bold font-mono mt-0.5 ${trainedResult.metrics.r2_score >= 0 ? 'text-teal-400' : 'text-rose-400'}`}>
                          {trainedResult.metrics.r2_score}
                        </p>
                        <span className="text-[10px] text-slate-500 block">Baseline R²: 0.0</span>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
                        <span className="text-[10px] text-slate-400 uppercase">RMSE</span>
                        <p className="text-lg font-bold text-indigo-400 font-mono mt-0.5">
                          {trainedResult.metrics.rmse.toLocaleString()}
                        </p>
                        <span className="text-[10px] text-slate-500 block">
                          Base: {trainedResult.metrics.baseline_rmse.toLocaleString()}
                        </span>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
                        <span className="text-[10px] text-slate-400 uppercase">MAE</span>
                        <p className="text-lg font-bold text-purple-400 font-mono mt-0.5">
                          {trainedResult.metrics.mae.toLocaleString()}
                        </p>
                        <span className="text-[10px] text-slate-500 block">
                          Base: {trainedResult.metrics.baseline_mae.toLocaleString()}
                        </span>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
                        <span className="text-[10px] text-slate-400 uppercase">Test Samples</span>
                        <p className="text-lg font-bold text-blue-400 font-mono mt-0.5">
                          {trainedResult.metrics.test_samples}
                        </p>
                      </div>
                    </>
                  )}

                  {trainedResult.task_type === 'clustering' && (
                    <>
                      <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
                        <span className="text-[10px] text-slate-400 uppercase">Silhouette</span>
                        <p className="text-lg font-bold text-teal-400 font-mono mt-0.5">
                          {trainedResult.metrics.silhouette_score}
                        </p>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
                        <span className="text-[10px] text-slate-400 uppercase">Inertia</span>
                        <p className="text-lg font-bold text-indigo-400 font-mono mt-0.5">
                          {trainedResult.metrics.inertia ? Math.round(trainedResult.metrics.inertia).toLocaleString() : 'N/A'}
                        </p>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
                        <span className="text-[10px] text-slate-400 uppercase">Davies-Bouldin</span>
                        <p className="text-lg font-bold text-purple-400 font-mono mt-0.5">
                          {trainedResult.metrics.davies_bouldin_score}
                        </p>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
                        <span className="text-[10px] text-slate-400 uppercase">Clusters</span>
                        <p className="text-lg font-bold text-blue-400 font-mono mt-0.5">
                          {trainedResult.metrics.n_clusters}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Confusion Matrix (Classification) or Actual vs Predicted Plot (Regression) */}
              {trainedResult.task_type === 'classification' && trainedResult.confusion_matrix && (
                <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3">
                    Confusion Matrix Heatmap
                  </h4>
                  <div className="h-60">
                    <Plot
                      data={[
                        {
                          z: trainedResult.confusion_matrix,
                          x: trainedResult.class_labels,
                          y: trainedResult.class_labels,
                          type: 'heatmap',
                          colorscale: 'Blues',
                          showscale: true,
                        },
                      ]}
                      layout={{
                        autosize: true,
                        paper_bgcolor: 'transparent',
                        plot_bgcolor: 'transparent',
                        font: { color: '#94a3b8', size: 10 },
                        margin: { l: 80, r: 40, t: 10, b: 60 },
                        xaxis: { title: 'Predicted Class', gridcolor: '#1e293b' },
                        yaxis: { title: 'Actual Class', gridcolor: '#1e293b' },
                      }}
                      useResizeHandler={true}
                      style={{ width: '100%', height: '100%' }}
                      config={{ displayModeBar: false }}
                    />
                  </div>
                </div>
              )}

              {trainedResult.task_type === 'regression' && trainedResult.metrics.residuals_sample && (
                <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3">
                    Actual vs. Predicted Plot
                  </h4>
                  <div className="h-60">
                    <Plot
                      data={[
                        {
                          x: trainedResult.metrics.residuals_sample.map((r: any) => r.actual),
                          y: trainedResult.metrics.residuals_sample.map((r: any) => r.predicted),
                          mode: 'markers',
                          type: 'scatter',
                          name: 'Predictions',
                          marker: { color: '#6366f1', size: 6, opacity: 0.7 },
                        },
                        {
                          x: trainedResult.metrics.residuals_sample.map((r: any) => r.actual),
                          y: trainedResult.metrics.residuals_sample.map((r: any) => r.actual),
                          mode: 'lines',
                          type: 'scatter',
                          name: 'Perfect 1:1 Fit',
                          line: { color: '#10b981', dash: 'dash', width: 2 },
                        },
                      ]}
                      layout={{
                        autosize: true,
                        paper_bgcolor: 'transparent',
                        plot_bgcolor: 'transparent',
                        font: { color: '#94a3b8', size: 10 },
                        margin: { l: 60, r: 30, t: 10, b: 50 },
                        xaxis: { title: 'Actual Test Values', gridcolor: '#1e293b' },
                        yaxis: { title: 'Predicted Values', gridcolor: '#1e293b' },
                      }}
                      useResizeHandler={true}
                      style={{ width: '100%', height: '100%' }}
                      config={{ displayModeBar: false }}
                    />
                  </div>
                </div>
              )}

              {/* Feature Importances Bar Chart */}
              {trainedResult.feature_importance && trainedResult.feature_importance.length > 0 && (
                <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3">
                    Top Feature Importances
                  </h4>
                  <div className="h-56">
                    <Plot
                      data={[
                        {
                          x: trainedResult.feature_importance.slice(0, 10).map((f) => f.importance).reverse(),
                          y: trainedResult.feature_importance.slice(0, 10).map((f) => f.feature).reverse(),
                          type: 'bar',
                          orientation: 'h',
                          marker: { color: '#6366f1' },
                        },
                      ]}
                      layout={{
                        autosize: true,
                        paper_bgcolor: 'transparent',
                        plot_bgcolor: 'transparent',
                        font: { color: '#94a3b8', size: 10 },
                        margin: { l: 120, r: 20, t: 10, b: 30 },
                        xaxis: { title: 'Importance Score', gridcolor: '#1e293b' },
                      }}
                      useResizeHandler={true}
                      style={{ width: '100%', height: '100%' }}
                      config={{ displayModeBar: false }}
                    />
                  </div>
                </div>
              )}

              {/* Interactive Live Prediction Simulator */}
              <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-2">
                  <Zap className="w-4 h-4 text-teal-400" />
                  <span>Live Single-Record Simulator</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-52 overflow-y-auto p-1">
                  {trainedResult.feature_columns.map((col) => (
                    <div key={col}>
                      <label className="block text-[10px] font-mono text-slate-400 mb-1">{col}</label>
                      <input
                        type="text"
                        value={singleInputs[col] ?? ''}
                        onChange={(e) => setSingleInputs({ ...singleInputs, [col]: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200"
                      />
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleRunSinglePredict}
                  disabled={isPredictingSingle}
                  className="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-semibold text-xs transition flex items-center justify-center space-x-1.5 shadow"
                >
                  <span>{isPredictingSingle ? 'Predicting...' : 'Simulate Prediction'}</span>
                </button>

                {singlePredResult && (
                  <div className="p-4 rounded-xl bg-slate-950 border border-teal-500/60 text-center">
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 block">
                      Predicted Output ({trainedResult.target_column || 'Cluster'})
                    </span>
                    <span className="text-2xl font-extrabold text-teal-300 font-mono block mt-1">
                      {String(singlePredResult.predictions[0])}
                    </span>

                    {singlePredResult.prediction_probabilities && singlePredResult.prediction_probabilities[0] && (
                      <div className="flex justify-center gap-4 mt-2 pt-2 border-t border-slate-800 text-[11px] text-slate-400">
                        {Object.entries(singlePredResult.prediction_probabilities[0]).map(([k, v]: any) => (
                          <span key={k}>
                            {k}: <strong className="text-slate-200">{(v * 100).toFixed(1)}%</strong>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Batch CSV Prediction Section */}
              <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-2">
                  <FileSpreadsheet className="w-4 h-4 text-indigo-400" />
                  <span>Batch CSV Scoring</span>
                </h4>

                <form onSubmit={handleRunBatchPredict} className="space-y-3">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => setBatchFile(e.target.files?.[0] || null)}
                    className="block w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-950 file:text-indigo-300 hover:file:bg-indigo-900 cursor-pointer"
                  />
                  <button
                    type="submit"
                    disabled={!batchFile || isPredictingBatch}
                    className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-semibold text-xs transition"
                  >
                    {isPredictingBatch ? 'Running Batch Scoring...' : 'Run Batch CSV Prediction'}
                  </button>
                </form>

                {batchResult && (
                  <div className="p-4 rounded-xl bg-slate-950 border border-indigo-800/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-300">
                        Processed <strong>{batchResult.total_rows}</strong> records successfully.
                      </span>
                      <button
                        onClick={handleDownloadBatch}
                        disabled={isDownloadingBatch}
                        className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-medium flex items-center space-x-1"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download Predictions CSV</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-12 rounded-2xl bg-slate-900/40 border border-dashed border-slate-800 text-center flex flex-col items-center justify-center min-h-[380px]">
              <Cpu className="w-12 h-12 text-slate-600 mb-3" />
              <h4 className="text-sm font-bold text-slate-300 mb-1">No Model Trained Yet</h4>
              <p className="text-xs text-slate-500 max-w-sm">
                Configure your target variable and features on the left, then click "Train Model" to generate honest evaluation metrics, feature importances, and interactive prediction tooling.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
