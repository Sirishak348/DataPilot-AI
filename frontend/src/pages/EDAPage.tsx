import React, { useState, useEffect } from 'react';
import Plot from 'react-plotly.js';
import {
  BarChart3,
  Sliders,
  Sparkles,
  Layers,
  TrendingUp,
  Activity,
  Maximize2,
  PieChart,
  Calendar,
  Grid,
} from 'lucide-react';
import { useDataset } from '../context/DatasetContext';
import { edaApi } from '../services/api';

export const EDAPage: React.FC = () => {
  const { selectedDataset, profile, useCleanedVersion } = useDataset();

  const [activeTab, setActiveTab] = useState<
    'histogram' | 'boxplot' | 'violin' | 'correlations' | 'scatter' | 'bubble' | 'pairplot' | 'barchart' | 'stackedbar' | 'timeseries' | 'missing' | 'missing_matrix' | 'distribution_comparison'
  >('histogram');

  // Chart parameters
  const [selectedNumCol, setSelectedNumCol] = useState<string>('');
  const [selectedNumCol2, setSelectedNumCol2] = useState<string>('');
  const [selectedSizeCol, setSelectedSizeCol] = useState<string>('');
  const [selectedCatCol, setSelectedCatCol] = useState<string>('');
  const [selectedCatCol2, setSelectedCatCol2] = useState<string>('');
  const [selectedDateCol, setSelectedDateCol] = useState<string>('');
  const [bins, setBins] = useState<number>(20);
  const [isAreaChart, setIsAreaChart] = useState<boolean>(false);
  const [pairCols, setPairCols] = useState<string[]>([]);

  // Chart data state
  const [chartData, setChartData] = useState<any>(null);
  const [isLoadingChart, setIsLoadingChart] = useState(false);

  const allColumns = profile?.columns?.map((c) => c.name) || [];
  const numericCols = profile?.columns?.filter((c) => c.inferred_type === 'numeric').map((c) => c.name) || [];
  const catCols = profile?.columns?.filter((c) => ['categorical', 'boolean', 'text'].includes(c.inferred_type)).map((c) => c.name) || [];
  const dateCols = profile?.columns?.filter((c) => c.inferred_type === 'datetime').map((c) => c.name) || [];

  useEffect(() => {
    if (numericCols.length > 0 && !selectedNumCol) {
      setSelectedNumCol(numericCols[0]);
    }
    if (numericCols.length > 1 && !selectedNumCol2) {
      setSelectedNumCol2(numericCols[1]);
    }
    if (numericCols.length > 2 && !selectedSizeCol) {
      setSelectedSizeCol(numericCols[2]);
    } else if (numericCols.length > 0 && !selectedSizeCol) {
      setSelectedSizeCol(numericCols[0]);
    }
    if (catCols.length > 0 && !selectedCatCol) {
      setSelectedCatCol(catCols[0]);
    }
    if (catCols.length > 1 && !selectedCatCol2) {
      setSelectedCatCol2(catCols[1]);
    }
    if (dateCols.length > 0 && !selectedDateCol) {
      setSelectedDateCol(dateCols[0]);
    } else if (profile?.columns?.length) {
      // If inferred_type didn't catch datetime, pick any column named Date or date if present
      const dateName = profile.columns.find((c) => c.name.toLowerCase().includes('date'))?.name;
      if (dateName && !selectedDateCol) setSelectedDateCol(dateName);
    }
    if (numericCols.length >= 2 && pairCols.length === 0) {
      setPairCols(numericCols.slice(0, 4));
    }
  }, [profile]);

  const loadChart = async () => {
    if (!selectedDataset) return;
    setIsLoadingChart(true);
    try {
      if (activeTab === 'histogram' && selectedNumCol) {
        const data = await edaApi.getHistogram(selectedDataset.id, selectedNumCol, bins, useCleanedVersion);
        setChartData(data);
      } else if (activeTab === 'boxplot' && selectedNumCol) {
        const data = await edaApi.getBoxplot(selectedDataset.id, selectedNumCol, selectedCatCol || undefined, useCleanedVersion);
        setChartData(data);
      } else if (activeTab === 'violin' && selectedNumCol) {
        const data = await edaApi.getViolin(selectedDataset.id, selectedNumCol, selectedCatCol || undefined, useCleanedVersion);
        setChartData(data);
      } else if (activeTab === 'correlations') {
        const data = await edaApi.getCorrelations(selectedDataset.id, useCleanedVersion);
        setChartData(data);
      } else if (activeTab === 'scatter' && selectedNumCol && selectedNumCol2) {
        const data = await edaApi.getScatter(selectedDataset.id, selectedNumCol, selectedNumCol2, selectedCatCol || undefined, 1000, useCleanedVersion);
        setChartData(data);
      } else if (activeTab === 'bubble' && selectedNumCol && selectedNumCol2 && selectedSizeCol) {
        const data = await edaApi.getBubble(selectedDataset.id, selectedNumCol, selectedNumCol2, selectedSizeCol, selectedCatCol || undefined, useCleanedVersion);
        setChartData(data);
      } else if (activeTab === 'pairplot' && pairCols.length >= 2) {
        const data = await edaApi.getScatterMatrix(selectedDataset.id, pairCols, useCleanedVersion);
        setChartData(data);
      } else if (activeTab === 'barchart' && selectedCatCol) {
        const data = await edaApi.getBarChart(selectedDataset.id, selectedCatCol, 15, useCleanedVersion);
        setChartData(data);
      } else if (activeTab === 'stackedbar' && selectedCatCol && selectedCatCol2) {
        const data = await edaApi.getStackedBar(selectedDataset.id, selectedCatCol, selectedCatCol2, useCleanedVersion);
        setChartData(data);
      } else if (activeTab === 'timeseries' && selectedDateCol && selectedNumCol) {
        const data = await edaApi.getTimeSeries(selectedDataset.id, selectedDateCol, selectedNumCol, useCleanedVersion);
        setChartData(data);
      } else if (activeTab === 'missing') {
        const data = await edaApi.getMissingChart(selectedDataset.id, useCleanedVersion);
        setChartData(data);
      } else if (activeTab === 'missing_matrix') {
        const data = await edaApi.getMissingMatrix(selectedDataset.id, useCleanedVersion);
        setChartData(data);
      } else if (activeTab === 'distribution_comparison' && pairCols.length > 0) {
        const data = await edaApi.getDistributionComparison(selectedDataset.id, pairCols, useCleanedVersion);
        setChartData(data);
      }
    } catch (e) {
      console.error('Failed to load chart data', e);
    } finally {
      setIsLoadingChart(false);
    }
  };

  useEffect(() => {
    loadChart();
  }, [
    selectedDataset?.id,
    activeTab,
    selectedNumCol,
    selectedNumCol2,
    selectedSizeCol,
    selectedCatCol,
    selectedCatCol2,
    selectedDateCol,
    bins,
    pairCols,
    useCleanedVersion,
  ]);

  if (!selectedDataset) {
    return <div className="p-8 text-center text-slate-400">Please select a dataset first.</div>;
  }

  // Generate Plotly traces and layout
  const getPlotConfig = () => {
    if (!chartData) return { data: [], layout: {} };

    const commonLayout: Record<string, any> = {
      autosize: true,
      paper_bgcolor: 'rgba(15, 23, 42, 0.0)',
      plot_bgcolor: 'rgba(15, 23, 42, 0.4)',
      font: { color: '#94a3b8', family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', size: 11 },
      margin: { l: 55, r: 35, t: 45, b: 55 },
    };

    if (activeTab === 'histogram') {
      return {
        data: [
          {
            x: chartData.bin_centers,
            y: chartData.counts,
            type: 'bar',
            marker: {
              color: '#6366f1',
              line: { color: '#4f46e5', width: 1 },
            },
            name: chartData.column,
          },
        ],
        layout: {
          ...commonLayout,
          title: `Distribution of ${chartData.column} (Mean: ${chartData.mean}, Median: ${chartData.median}, Std: ${chartData.std})`,
          xaxis: { title: chartData.column, gridcolor: '#1e293b' },
          yaxis: { title: 'Frequency', gridcolor: '#1e293b' },
        },
      };
    }

    if (activeTab === 'boxplot') {
      const traces = (chartData.groups || []).map((grp: any, i: number) => ({
        type: 'box',
        name: grp.group_name,
        q1: [grp.q1],
        median: [grp.median],
        q3: [grp.q3],
        lowerfence: [grp.lower_whisker],
        upperfence: [grp.upper_whisker],
        y: grp.outliers,
        marker: { color: ['#6366f1', '#14b8a6', '#f59e0b', '#ec4899', '#8b5cf6'][i % 5] },
      }));
      return {
        data: traces,
        layout: {
          ...commonLayout,
          title: `Box Plot: ${chartData.numeric_column} ${chartData.group_by_column ? `by ${chartData.group_by_column}` : ''}`,
          yaxis: { title: chartData.numeric_column, gridcolor: '#1e293b' },
        },
      };
    }

    if (activeTab === 'violin') {
      const traces = (chartData.groups || []).map((grp: any, i: number) => ({
        type: 'violin',
        y: grp.values,
        name: grp.group_name,
        box: { visible: true },
        meanline: { visible: true },
        marker: { color: ['#14b8a6', '#6366f1', '#f59e0b', '#ec4899', '#8b5cf6'][i % 5] },
      }));
      return {
        data: traces,
        layout: {
          ...commonLayout,
          title: `Violin Density Plot: ${chartData.numeric_column}`,
          yaxis: { title: chartData.numeric_column, gridcolor: '#1e293b' },
        },
      };
    }

    if (activeTab === 'correlations') {
      return {
        data: [
          {
            z: chartData.matrix,
            x: chartData.columns,
            y: chartData.columns,
            type: 'heatmap',
            colorscale: [
              [0, '#ef4444'],
              [0.5, '#0f172a'],
              [1, '#10b981'],
            ],
            zmin: -1,
            zmax: 1,
            hoverongaps: false,
          },
        ],
        layout: {
          ...commonLayout,
          title: 'Pearson Correlation Heatmap (Diverging)',
          margin: { l: 80, r: 40, t: 40, b: 80 },
        },
      };
    }

    if (activeTab === 'scatter') {
      const groupsMap: Record<string, { x: number[]; y: number[] }> = {};
      (chartData.points || []).forEach((pt: any) => {
        if (!groupsMap[pt.group]) groupsMap[pt.group] = { x: [], y: [] };
        groupsMap[pt.group].x.push(pt.x);
        groupsMap[pt.group].y.push(pt.y);
      });

      const traces: any[] = Object.keys(groupsMap).map((grpName, i) => ({
        x: groupsMap[grpName].x,
        y: groupsMap[grpName].y,
        mode: 'markers',
        type: 'scatter',
        name: grpName,
        marker: {
          size: 6,
          opacity: 0.8,
          color: ['#6366f1', '#14b8a6', '#f59e0b', '#ec4899', '#38bdf8'][i % 5],
        },
      }));

      // Add Trendline if available
      if (chartData.trendline && chartData.points?.length > 0) {
        const xVals = chartData.points.map((p: any) => p.x);
        const minX = Math.min(...xVals);
        const maxX = Math.max(...xVals);
        const t = chartData.trendline;
        traces.push({
          x: [minX, maxX],
          y: [minX * t.slope + t.intercept, maxX * t.slope + t.intercept],
          mode: 'lines',
          type: 'scatter',
          name: `Trend (r=${t.r_correlation})`,
          line: { color: '#f43f5e', width: 2, dash: 'dash' },
        });
      }

      return {
        data: traces,
        layout: {
          ...commonLayout,
          title: `${chartData.x_column} vs. ${chartData.y_column}`,
          xaxis: { title: chartData.x_column, gridcolor: '#1e293b' },
          yaxis: { title: chartData.y_column, gridcolor: '#1e293b' },
        },
      };
    }

    if (activeTab === 'bubble') {
      const bubbles = chartData.bubbles || [];
      return {
        data: [
          {
            x: bubbles.map((b: any) => b.x),
            y: bubbles.map((b: any) => b.y),
            mode: 'markers',
            type: 'scatter',
            marker: {
              size: bubbles.map((b: any) => Math.min(40, Math.max(6, b.size))),
              color: '#38bdf8',
              opacity: 0.7,
              line: { color: '#0284c7', width: 1 },
            },
            text: bubbles.map((b: any) => `Size (${chartData.size_column}): ${b.size}`),
          },
        ],
        layout: {
          ...commonLayout,
          title: `Bubble Chart: ${chartData.x_column} vs ${chartData.y_column} (Bubble Size: ${chartData.size_column})`,
          xaxis: { title: chartData.x_column, gridcolor: '#1e293b' },
          yaxis: { title: chartData.y_column, gridcolor: '#1e293b' },
        },
      };
    }

    if (activeTab === 'pairplot') {
      const dimensions = (chartData.columns || []).map((col: string) => ({
        label: col,
        values: (chartData.records || []).map((r: any) => r[col]),
      }));
      return {
        data: [
          {
            type: 'splom',
            dimensions: dimensions,
            marker: { color: '#6366f1', size: 4, opacity: 0.6 },
          },
        ],
        layout: {
          ...commonLayout,
          title: 'Pair Plot / Scatter Matrix',
          margin: { l: 80, r: 40, t: 50, b: 80 },
        },
      };
    }

    if (activeTab === 'barchart') {
      return {
        data: [
          {
            x: chartData.labels,
            y: chartData.values,
            type: 'bar',
            marker: { color: '#14b8a6' },
            text: chartData.percentages?.map((p: number) => `${p}%`),
            textposition: 'auto',
          },
        ],
        layout: {
          ...commonLayout,
          title: `Category Distribution: ${chartData.column}`,
          xaxis: { title: chartData.column, gridcolor: '#1e293b' },
          yaxis: { title: 'Count', gridcolor: '#1e293b' },
        },
      };
    }

    if (activeTab === 'stackedbar') {
      const traces = (chartData.series || []).map((s: any, i: number) => ({
        x: chartData.categories,
        y: s.values,
        name: s.name,
        type: 'bar',
        marker: { color: ['#6366f1', '#14b8a6', '#f59e0b', '#ec4899', '#38bdf8', '#8b5cf6'][i % 6] },
      }));
      return {
        data: traces,
        layout: {
          ...commonLayout,
          barmode: 'stack',
          title: `Stacked Comparison: ${chartData.primary_column} vs ${chartData.secondary_column}`,
          xaxis: { title: chartData.primary_column, gridcolor: '#1e293b' },
          yaxis: { title: 'Count', gridcolor: '#1e293b' },
        },
      };
    }

    if (activeTab === 'timeseries') {
      const isArea = isAreaChart;
      return {
        data: [
          {
            x: chartData.dates,
            y: isArea ? chartData.cumulative_values : chartData.values,
            type: 'scatter',
            mode: 'lines+markers',
            fill: isArea ? 'tozeroy' : 'none',
            line: { color: isArea ? '#06b6d4' : '#6366f1', width: 2 },
            marker: { size: 4 },
            name: chartData.value_column,
          },
        ],
        layout: {
          ...commonLayout,
          title: `${isArea ? 'Cumulative Area Trend' : 'Time-Series Trend'}: ${chartData.value_column} across ${chartData.date_column}`,
          xaxis: { title: chartData.date_column, gridcolor: '#1e293b' },
          yaxis: { title: chartData.value_column, gridcolor: '#1e293b' },
        },
      };
    }

    if (activeTab === 'missing') {
      return {
        data: [
          {
            x: chartData.columns,
            y: chartData.counts,
            type: 'bar',
            marker: { color: '#f59e0b' },
            text: chartData.percentages?.map((p: number) => `${p}%`),
            textposition: 'auto',
          },
        ],
        layout: {
          ...commonLayout,
          title: `Missing Values Count by Column (Total Missing Features: ${chartData.total_missing_columns})`,
          xaxis: { title: 'Column', gridcolor: '#1e293b' },
          yaxis: { title: 'Missing Rows', gridcolor: '#1e293b' },
        },
      };
    }

    if (activeTab === 'missing_matrix') {
      return {
        data: [
          {
            z: chartData.matrix,
            x: chartData.columns,
            y: Array.from({ length: chartData.rows_count || 1 }, (_, i) => `Row ${i + 1}`),
            type: 'heatmap',
            colorscale: [
              [0, '#10b981'],
              [1, '#ef4444'],
            ],
            showscale: false,
          },
        ],
        layout: {
          ...commonLayout,
          title: 'Missingness Heatmap Matrix (Green = Valid, Red = Missing)',
          margin: { l: 80, r: 30, t: 40, b: 80 },
        },
      };
    }

    if (activeTab === 'distribution_comparison') {
      const traces = (chartData.distributions || []).map((d: any, i: number) => ({
        x: d.centers,
        y: d.densities,
        mode: 'lines',
        type: 'scatter',
        name: d.column,
        line: { color: ['#6366f1', '#14b8a6', '#f59e0b', '#ec4899'][i % 4], width: 2.5 },
      }));
      return {
        data: traces,
        layout: {
          ...commonLayout,
          title: 'Multi-Feature Distribution & Density Comparison',
          xaxis: { title: 'Values', gridcolor: '#1e293b' },
          yaxis: { title: 'Probability Density', gridcolor: '#1e293b' },
        },
      };
    }

    return { data: [], layout: {} };
  };

  const plotConfig = getPlotConfig();

  return (
    <div className="p-6 md:p-8 space-y-7 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">
            Exploratory Data Analysis (EDA)
          </h1>
          <p className="text-xs text-slate-400">
            Professional Plotly visual suite with dynamic interactive filtering, correlations, and trendlines.
          </p>
        </div>
      </div>

      {/* Chart Type Tabs */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-2 border-b border-slate-800/60 scrollbar-thin">
        {[
          { id: 'histogram', label: 'Histogram' },
          { id: 'boxplot', label: 'Box Plot' },
          { id: 'violin', label: 'Violin Density' },
          { id: 'correlations', label: 'Correlation Heatmap' },
          { id: 'scatter', label: 'Scatter + Trendline' },
          { id: 'bubble', label: 'Bubble Chart' },
          { id: 'pairplot', label: 'Pair Plot Matrix' },
          { id: 'barchart', label: 'Categorical Bar' },
          { id: 'stackedbar', label: 'Stacked Bar' },
          { id: 'timeseries', label: 'Time-Series Trend' },
          { id: 'missing', label: 'Missing Values Bar' },
          { id: 'missing_matrix', label: 'Missingness Matrix' },
          { id: 'distribution_comparison', label: 'Distribution Overlay' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
              activeTab === tab.id
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-850'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Dynamic Controls Bar */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-wrap items-center gap-4 text-xs">
        {['histogram', 'boxplot', 'violin', 'timeseries'].includes(activeTab) && (
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Primary Numeric Feature</label>
            <select
              value={selectedNumCol}
              onChange={(e) => setSelectedNumCol(e.target.value)}
              className="px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 font-mono"
            >
              {numericCols.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        )}

        {activeTab === 'histogram' && (
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Bins ({bins})</label>
            <input
              type="range"
              min={5}
              max={60}
              value={bins}
              onChange={(e) => setBins(parseInt(e.target.value))}
              className="accent-indigo-500 cursor-pointer"
            />
          </div>
        )}

        {['boxplot', 'violin', 'scatter', 'bubble'].includes(activeTab) && (
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Category / Grouping (Optional)</label>
            <select
              value={selectedCatCol}
              onChange={(e) => setSelectedCatCol(e.target.value)}
              className="px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 font-mono"
            >
              <option value="">None (Overall)</option>
              {catCols.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        )}

        {['scatter', 'bubble'].includes(activeTab) && (
          <>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">X-Axis Feature</label>
              <select
                value={selectedNumCol}
                onChange={(e) => setSelectedNumCol(e.target.value)}
                className="px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 font-mono"
              >
                {numericCols.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Y-Axis Feature</label>
              <select
                value={selectedNumCol2}
                onChange={(e) => setSelectedNumCol2(e.target.value)}
                className="px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 font-mono"
              >
                {numericCols.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </>
        )}

        {activeTab === 'bubble' && (
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Size Feature (Radius)</label>
            <select
              value={selectedSizeCol}
              onChange={(e) => setSelectedSizeCol(e.target.value)}
              className="px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 font-mono"
            >
              {numericCols.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        )}

        {activeTab === 'barchart' && (
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Categorical Feature</label>
            <select
              value={selectedCatCol}
              onChange={(e) => setSelectedCatCol(e.target.value)}
              className="px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 font-mono"
            >
              {catCols.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        )}

        {activeTab === 'stackedbar' && (
          <>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Primary Category</label>
              <select
                value={selectedCatCol}
                onChange={(e) => setSelectedCatCol(e.target.value)}
                className="px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 font-mono"
              >
                {catCols.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Secondary (Stack) Category</label>
              <select
                value={selectedCatCol2}
                onChange={(e) => setSelectedCatCol2(e.target.value)}
                className="px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 font-mono"
              >
                {catCols.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </>
        )}

        {activeTab === 'timeseries' && (
          <>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Date Feature</label>
              <select
                value={selectedDateCol}
                onChange={(e) => setSelectedDateCol(e.target.value)}
                className="px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 font-mono"
              >
                {allColumns.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center space-x-2 pt-4">
              <input
                type="checkbox"
                id="areaToggle"
                checked={isAreaChart}
                onChange={(e) => setIsAreaChart(e.target.checked)}
                className="rounded accent-indigo-500"
              />
              <label htmlFor="areaToggle" className="text-slate-300 cursor-pointer">
                Cumulative Area Mode
              </label>
            </div>
          </>
        )}
      </div>

      {/* Chart Canvas Area */}
      <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 min-h-[490px] flex flex-col justify-center items-center">
        {isLoadingChart ? (
          <div className="flex flex-col items-center space-y-3">
            <div className="w-8 h-8 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
            <span className="text-xs text-slate-400">Computing visualization points...</span>
          </div>
        ) : (
          <div className="w-full h-[460px]">
            <Plot
              data={plotConfig.data as any}
              layout={plotConfig.layout as any}
              useResizeHandler={true}
              style={{ width: '100%', height: '100%' }}
              config={{ responsive: true, displayModeBar: true, displaylogo: false }}
            />
          </div>
        )}
      </div>
    </div>
  );
};
