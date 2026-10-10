import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Trash2,
  Plus,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Download,
  RotateCcw,
  Layers,
  Wand2,
  Calculator,
  Loader2,
  Info,
} from 'lucide-react';
import { useDataset } from '../context/DatasetContext';
import { cleaningApi, datasetsApi } from '../services/api';
import { CleaningOperation, DiffSummary, DerivedRecommendation } from '../types';

export const CleaningPage: React.FC = () => {
  const { selectedDataset, profile, refreshDatasets, refreshProfile, useCleanedVersion, setUseCleanedVersion } = useDataset();

  const [operations, setOperations] = useState<CleaningOperation[]>([]);
  const [activeOpType, setActiveOpType] = useState<CleaningOperation['op_type']>('remove_duplicates');

  // Operation specific form parameters
  const [selectedColumn, setSelectedColumn] = useState<string>('');
  const [imputeStrategy, setImputeStrategy] = useState<string>('median');
  const [fillValue, setFillValue] = useState<string>('');
  const [newColName, setNewColName] = useState<string>('');
  const [targetType, setTargetType] = useState<string>('float');
  const [outlierMethod, setOutlierMethod] = useState<'cap_iqr' | 'remove_iqr' | 'cap_zscore'>('cap_iqr');
  const [outlierThreshold, setOutlierThreshold] = useState<number>(1.5);
  const [dropStrategy, setDropStrategy] = useState<'any' | 'all'>('any');

  // Derived recommendation
  const [derivedRecs, setDerivedRecs] = useState<DerivedRecommendation[]>([]);

  // Diff & execution states
  const [diffSummary, setDiffSummary] = useState<DiffSummary | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const columns = profile?.columns?.map((c) => c.name) || [];
  const selectedColObj = profile?.columns?.find((c) => c.name === selectedColumn);
  const selectedColType = selectedColObj?.inferred_type || 'numeric';
  const numericColumns = profile?.columns?.filter((c) => c.inferred_type === 'numeric').map((c) => c.name) || [];

  useEffect(() => {
    if (columns.length > 0 && !selectedColumn) {
      setSelectedColumn(columns[0]);
    }
  }, [columns, selectedColumn]);

  useEffect(() => {
    if (selectedDataset) {
      cleaningApi.getDerivedRecommendations(selectedDataset.id, useCleanedVersion)
        .then((recs) => setDerivedRecs(recs || []))
        .catch(() => setDerivedRecs([]));
    }
  }, [selectedDataset?.id, useCleanedVersion]);

  // Adjust default impute strategy based on column type
  useEffect(() => {
    if (selectedColType === 'datetime') {
      setImputeStrategy('forward_fill');
    } else if (selectedColType === 'categorical' || selectedColType === 'text') {
      setImputeStrategy('mode');
    } else if (selectedColType === 'numeric') {
      setImputeStrategy('median');
    }
  }, [selectedColumn, selectedColType]);

  const handleAddOperation = () => {
    setErrorMessage(null);
    let params: Record<string, any> = {};

    if (activeOpType === 'remove_duplicates') {
      params = {};
    } else if (activeOpType === 'drop_missing_rows') {
      params = { strategy: dropStrategy };
    } else if (activeOpType === 'impute_missing') {
      if (!selectedColumn) {
        setErrorMessage('Please select a target column for imputation.');
        return;
      }
      if (['mean', 'median'].includes(imputeStrategy) && selectedColType !== 'numeric') {
        setErrorMessage(`Mean and Median imputation cannot be applied to non-numeric column '${selectedColumn}'. Use Mode or Forward/Backward Fill.`);
        return;
      }
      params = { column: selectedColumn, strategy: imputeStrategy, fill_value: fillValue || undefined };
    } else if (activeOpType === 'drop_columns') {
      if (!selectedColumn) {
        setErrorMessage('Please select a column to drop.');
        return;
      }
      if (columns.length <= 1) {
        setErrorMessage('Cannot drop the only remaining column in the dataset.');
        return;
      }
      params = { columns: [selectedColumn] };
    } else if (activeOpType === 'rename_columns') {
      if (!selectedColumn || !newColName.trim()) {
        setErrorMessage('Please provide a valid new column name.');
        return;
      }
      if (columns.includes(newColName.trim()) && newColName.trim() !== selectedColumn) {
        setErrorMessage(`Column '${newColName.trim()}' already exists in dataset.`);
        return;
      }
      params = { mapping: { [selectedColumn]: newColName.trim() } };
    } else if (activeOpType === 'convert_type') {
      if (!selectedColumn) return;
      params = { column: selectedColumn, target_type: targetType };
    } else if (activeOpType === 'treat_outliers') {
      if (!selectedColumn) return;
      if (selectedColType !== 'numeric') {
        setErrorMessage(`Outlier treatment is only applicable to numeric columns. Column '${selectedColumn}' is of type ${selectedColType}.`);
        return;
      }
      params = { column: selectedColumn, method: outlierMethod, threshold: outlierThreshold };
    }

    setOperations([...operations, { op_type: activeOpType, params }]);
    setNewColName('');
  };

  const handleAddDerivedRec = (rec: DerivedRecommendation) => {
    const op: CleaningOperation = {
      op_type: 'recalculate_derived',
      params: {
        target_column: rec.derived_column,
        source_columns: rec.source_columns,
        operation: rec.operation,
      },
    };
    setOperations([...operations, op]);
    setSuccessMessage(`Added step: Recalculate '${rec.derived_column}' from '${rec.source_columns.join(' + ')}'`);
  };

  const handleRemoveOp = (idx: number) => {
    setOperations(operations.filter((_, i) => i !== idx));
  };

  const handlePreviewDiff = async () => {
    if (!selectedDataset || operations.length === 0) return;
    setIsProcessing(true);
    setErrorMessage(null);
    try {
      const diff = await cleaningApi.preview(selectedDataset.id, operations);
      setDiffSummary(diff);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.detail || 'Failed to preview transformations.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApplyCleaning = async (saveAsNew = false) => {
    if (!selectedDataset || operations.length === 0) return;
    setIsProcessing(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await cleaningApi.apply(selectedDataset.id, operations, saveAsNew);
      setDiffSummary(res.diff_summary);
      setSuccessMessage(res.message);
      setOperations([]);
      await refreshDatasets();
      await refreshProfile();
      setUseCleanedVersion(true);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.detail || 'Failed to apply cleaning operations.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadCleaned = async () => {
    if (!selectedDataset) return;
    setIsDownloading(true);
    try {
      await datasetsApi.downloadCsv(selectedDataset.id, 'cleaned', `cleaned_${selectedDataset.name}.csv`);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.detail || 'Failed to download cleaned CSV artifact.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleResetCleaning = async () => {
    if (!selectedDataset) return;
    if (!window.confirm('Reset dataset back to original uploaded state?')) return;
    try {
      await cleaningApi.reset(selectedDataset.id);
      await refreshDatasets();
      await refreshProfile();
      setUseCleanedVersion(false);
      setDiffSummary(null);
      setSuccessMessage('Dataset reset to original raw state.');
    } catch (err: any) {
      setErrorMessage(err.response?.data?.detail || 'Failed to reset dataset.');
    }
  };

  if (!selectedDataset) {
    return (
      <div className="p-8 text-center text-slate-400">
        Please select or upload a dataset first.
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-7 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
        <div>
          <div className="flex items-center space-x-2.5 mb-1">
            <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">
              Data Cleaning Studio
            </h1>
            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800">
              {selectedDataset.name}
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Build a reproducible cleaning pipeline. Preview before-and-after audit diffs with zero raw data loss.
          </p>
        </div>

        {selectedDataset.has_cleaned_version && (
          <div className="flex items-center space-x-2.5">
            <button
              onClick={handleDownloadCleaned}
              disabled={isDownloading}
              className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:bg-slate-800 text-white text-xs font-semibold shadow-sm transition flex items-center space-x-1.5"
            >
              {isDownloading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Downloading...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Cleaned CSV</span>
                </>
              )}
            </button>
            <button
              onClick={handleResetCleaning}
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs border border-slate-700 transition"
              title="Reset to Original Raw State"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
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

      {/* Derived Feature Advisory Banner (e.g. Wind+Solar = Wind + Solar) */}
      {derivedRecs.length > 0 && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-950/80 to-slate-900 border border-indigo-500/40 space-y-2">
          {derivedRecs.map((rec, idx) => (
            <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-start space-x-2.5">
                <Calculator className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-slate-100">Derived Feature Detected: </span>
                  <span className="text-slate-300">
                    <code className="text-teal-300 font-mono">{rec.derived_column}</code> is mathematically defined as <code className="text-indigo-300 font-mono">{rec.formula}</code>.
                  </span>
                  <p className="text-[11px] text-slate-400 mt-0.5">{rec.message}</p>
                </div>
              </div>
              <button
                onClick={() => handleAddDerivedRec(rec)}
                className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-medium text-[11px] shrink-0 self-start sm:self-auto transition shadow-sm"
              >
                + Recalculate {rec.derived_column}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Two Column Workspace: Tool Palette on Left, Pipeline Queue on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Operation Builder (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-sm">
            <h3 className="text-sm font-bold text-slate-100 mb-4 flex items-center space-x-2">
              <Wand2 className="w-4 h-4 text-indigo-400" />
              <span>Select Transformation Tool</span>
            </h3>

            {/* Operation Type Tabs */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-6">
              {[
                { id: 'remove_duplicates', label: 'Deduplication' },
                { id: 'impute_missing', label: 'Impute Nulls' },
                { id: 'drop_missing_rows', label: 'Drop Missing' },
                { id: 'treat_outliers', label: 'Treat Outliers' },
                { id: 'rename_columns', label: 'Rename Column' },
                { id: 'convert_type', label: 'Cast Data Type' },
                { id: 'drop_columns', label: 'Drop Columns' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveOpType(tab.id as any);
                    setErrorMessage(null);
                  }}
                  className={`px-3 py-2 rounded-xl text-xs font-medium transition text-left ${
                    activeOpType === tab.id
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Config Form based on active operation */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-4">
              {activeOpType === 'remove_duplicates' && (
                <div>
                  <h4 className="text-xs font-bold text-slate-200 mb-1">Remove Duplicate Rows</h4>
                  <p className="text-xs text-slate-400">
                    Scans the entire dataset for duplicate rows and retains the first unique instance.
                  </p>
                </div>
              )}

              {activeOpType === 'drop_missing_rows' && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-200">Drop Rows With Null Values</h4>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Drop Condition</label>
                    <select
                      value={dropStrategy}
                      onChange={(e) => setDropStrategy(e.target.value as any)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-200"
                    >
                      <option value="any">Drop row if ANY cell is missing</option>
                      <option value="all">Drop row only if ALL cells are missing</option>
                    </select>
                  </div>
                </div>
              )}

              {activeOpType === 'impute_missing' && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-200">Impute Missing Values</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Target Column</label>
                      <select
                        value={selectedColumn}
                        onChange={(e) => setSelectedColumn(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-200 font-mono"
                      >
                        {columns.map((col) => {
                          const colType = profile?.columns?.find((c) => c.name === col)?.inferred_type;
                          return (
                            <option key={col} value={col}>
                              {col} ({colType || 'unknown'})
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs text-slate-400 mb-1">
                        Imputation Strategy ({selectedColType})
                      </label>
                      <select
                        value={imputeStrategy}
                        onChange={(e) => setImputeStrategy(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-200"
                      >
                        {selectedColType === 'numeric' && (
                          <>
                            <option value="median">Median (Recommended for Numeric)</option>
                            <option value="mean">Mean (Average)</option>
                            <option value="mode">Mode (Most Frequent)</option>
                            <option value="constant">Constant Numeric Value</option>
                          </>
                        )}
                        {(selectedColType === 'categorical' || selectedColType === 'text' || selectedColType === 'boolean') && (
                          <>
                            <option value="mode">Mode (Most Frequent Category)</option>
                            <option value="unknown_category">Assign "Unknown" Category</option>
                            <option value="constant">Custom Constant Text</option>
                          </>
                        )}
                        {selectedColType === 'datetime' && (
                          <>
                            <option value="forward_fill">Forward Fill (ffill)</option>
                            <option value="backward_fill">Backward Fill (bfill)</option>
                            <option value="mode">Mode (Most Frequent Date)</option>
                          </>
                        )}
                      </select>
                    </div>
                  </div>

                  {imputeStrategy === 'constant' && (
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Fill Constant Value</label>
                      <input
                        type="text"
                        value={fillValue}
                        onChange={(e) => setFillValue(e.target.value)}
                        placeholder={selectedColType === 'numeric' ? 'e.g. 0.0' : 'e.g. Unknown'}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-200"
                      />
                    </div>
                  )}
                </div>
              )}

              {activeOpType === 'treat_outliers' && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-200">Outlier Treatment</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Numeric Feature</label>
                      <select
                        value={selectedColumn}
                        onChange={(e) => setSelectedColumn(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-200 font-mono"
                      >
                        {numericColumns.map((col) => (
                          <option key={col} value={col}>{col}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Treatment Method</label>
                      <select
                        value={outlierMethod}
                        onChange={(e) => setOutlierMethod(e.target.value as any)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-200"
                      >
                        <option value="cap_iqr">Winsorize / Cap at IQR Bounds [Q1-1.5*IQR, Q3+1.5*IQR]</option>
                        <option value="remove_iqr">Drop Outlier Rows (IQR)</option>
                        <option value="cap_zscore">Z-Score Capping (|Z| &gt; 3.0)</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {activeOpType === 'rename_columns' && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-200">Rename Column</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Select Column</label>
                      <select
                        value={selectedColumn}
                        onChange={(e) => setSelectedColumn(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-200 font-mono"
                      >
                        {columns.map((col) => (
                          <option key={col} value={col}>{col}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">New Name</label>
                      <input
                        type="text"
                        value={newColName}
                        onChange={(e) => setNewColName(e.target.value)}
                        placeholder="e.g. customer_age"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-200"
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeOpType === 'convert_type' && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-200">Convert Column Data Type</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Select Column</label>
                      <select
                        value={selectedColumn}
                        onChange={(e) => setSelectedColumn(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-200 font-mono"
                      >
                        {columns.map((col) => (
                          <option key={col} value={col}>{col}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Target Type</label>
                      <select
                        value={targetType}
                        onChange={(e) => setTargetType(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-200"
                      >
                        <option value="float">Float (Numeric Decimal)</option>
                        <option value="int">Integer (Whole Number)</option>
                        <option value="string">String / Text</option>
                        <option value="datetime">Datetime (Date/Time)</option>
                        <option value="category">Category</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {activeOpType === 'drop_columns' && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-200">Drop Column</h4>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Column to Remove</label>
                    <select
                      value={selectedColumn}
                      onChange={(e) => setSelectedColumn(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-200 font-mono"
                    >
                      {columns.map((col) => (
                        <option key={col} value={col}>{col}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <button
                onClick={handleAddOperation}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow transition flex items-center space-x-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Add Step to Pipeline Queue</span>
              </button>
            </div>
          </div>
        </div>

        {/* Pipeline Queue & Audit Diff (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                <Layers className="w-4 h-4 text-teal-400" />
                <span>Cleaning Queue ({operations.length})</span>
              </h3>
              {operations.length > 0 && (
                <button
                  onClick={() => setOperations([])}
                  className="text-[11px] text-slate-500 hover:text-rose-400 transition"
                >
                  Clear Queue
                </button>
              )}
            </div>

            {operations.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-6 text-center border border-dashed border-slate-800 rounded-xl">
                No transformation steps added yet. Select tools on the left.
              </p>
            ) : (
              <div className="space-y-2 mb-4">
                {operations.map((op, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-semibold text-indigo-300 capitalize">
                        {idx + 1}. {op.op_type.replace(/_/g, ' ')}
                      </span>
                      <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                        {JSON.stringify(op.params)}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRemoveOp(idx)}
                      className="text-slate-500 hover:text-rose-400 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {operations.length > 0 && (
              <div className="flex flex-col gap-2 pt-2">
                <button
                  onClick={handlePreviewDiff}
                  disabled={isProcessing}
                  className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-semibold border border-slate-700 transition"
                >
                  {isProcessing ? 'Simulating...' : 'Preview Transformation Diff'}
                </button>

                <button
                  onClick={() => handleApplyCleaning(false)}
                  disabled={isProcessing}
                  className="w-full py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow transition"
                >
                  {isProcessing ? 'Applying...' : 'Apply & Save Cleaned Artifact'}
                </button>
              </div>
            )}
          </div>

          {/* Diff Summary View */}
          {diffSummary && (
            <div className="p-6 rounded-2xl bg-slate-900/90 border border-teal-500/40 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-teal-300 uppercase tracking-wider flex items-center space-x-1.5">
                  <ShieldCheck className="w-4 h-4 text-teal-400" />
                  <span>Before vs After Audit Diff</span>
                </h4>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase block">Rows</span>
                  <p className="font-mono text-slate-200 mt-1">
                    {diffSummary.original_row_count} → <span className="text-teal-400 font-bold">{diffSummary.new_row_count}</span>
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase block">Missing Values</span>
                  <p className="font-mono text-slate-200 mt-1">
                    {diffSummary.missing_values_before} → <span className="text-teal-400 font-bold">{diffSummary.missing_values_after}</span>
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase block">Dupes Removed</span>
                  <p className="font-mono text-indigo-400 font-bold mt-1">
                    {diffSummary.duplicates_removed}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase block">Quality Score</span>
                  <p className="font-mono text-slate-200 mt-1">
                    {diffSummary.quality_score_before} → <span className="text-teal-400 font-bold">{diffSummary.quality_score_after}</span>
                  </p>
                </div>
              </div>

              {/* Applied Logs */}
              <div className="space-y-1.5 pt-2 border-t border-slate-800 text-[11px] text-slate-300">
                {diffSummary.applied_operations.map((log, i) => (
                  <p key={i} className="flex items-center space-x-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                    <span>{log.message || log.action}</span>
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
