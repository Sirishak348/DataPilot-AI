import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Sparkles,
  BarChart3,
  Cpu,
  Bot,
  ShieldCheck,
  Download,
  ArrowRight,
  Database,
  Layers,
  FileCheck2,
  CheckCircle2,
  Zap,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useDataset } from '../context/DatasetContext';

export const LandingPage: React.FC = () => {
  const { user, demoLogin } = useAuth();
  const { loadSampleDataset } = useDataset();
  const navigate = useNavigate();

  const handleLaunchSample = async (type: 'churn' | 'housing' | 'segmentation') => {
    if (!user) {
      await demoLogin();
    }
    await loadSampleDataset(type);
    navigate('/dashboard');
  };

  const handleExploreDemo = async () => {
    if (!user) {
      await demoLogin();
    }
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-indigo-500 selection:text-white">
      {/* Background Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[500px] overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-[-100px] left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-indigo-600/20 blur-[130px] rounded-full"></div>
        <div className="absolute top-[100px] left-1/3 w-[400px] h-[250px] bg-teal-500/15 blur-[120px] rounded-full"></div>
      </div>

      {/* Hero Section */}
      <section className="pt-20 pb-16 px-4 md:px-6 max-w-6xl mx-auto text-center">
        <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-indigo-950/80 border border-indigo-700/50 text-indigo-300 text-xs font-semibold mb-6 shadow-sm shadow-indigo-900/30">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span>Automated Data Analytics &amp; Machine Learning SaaS</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-slate-100 max-w-4xl mx-auto leading-tight sm:leading-none mb-6">
          From <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-indigo-200 to-teal-300">Raw Data</span> to{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-300 via-emerald-200 to-indigo-300">Intelligent Decisions</span>
        </h1>

        <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          Upload any CSV dataset to automatically profile data quality, run interactive exploratory analysis, clean dirty rows, train ML models, and converse with a Google Gemini AI consultant.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
          <button
            onClick={handleExploreDemo}
            className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-semibold text-sm shadow-lg shadow-indigo-600/30 transition flex items-center justify-center space-x-2"
          >
            <Zap className="w-4 h-4" />
            <span>Launch Live Demo Workspace</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          
          <Link
            to="/auth?tab=register"
            className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-850 text-slate-200 hover:text-white font-semibold text-sm border border-slate-800 transition"
          >
            Create Free Account
          </Link>
        </div>

        {/* Quick Sample Dataset Cards */}
        <div className="text-left max-w-4xl mx-auto pt-6 border-t border-slate-800/80">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4 text-center">
            Or test instantly with pre-loaded real-world datasets:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => handleLaunchSample('churn')}
              className="p-4 rounded-xl bg-slate-900/80 hover:bg-slate-850 border border-slate-800 hover:border-indigo-500/50 text-left transition group"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/50">
                  Classification
                </span>
                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-transform" />
              </div>
              <h4 className="text-sm font-bold text-slate-200 group-hover:text-white">Customer Churn</h4>
              <p className="text-xs text-slate-400 mt-1">
                750 customer records with contracts, internet services &amp; churn indicators.
              </p>
            </button>

            <button
              onClick={() => handleLaunchSample('housing')}
              className="p-4 rounded-xl bg-slate-900/80 hover:bg-slate-850 border border-slate-800 hover:border-teal-500/50 text-left transition group"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-teal-950 text-teal-300 border border-teal-800/50">
                  Regression
                </span>
                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-teal-400 group-hover:translate-x-0.5 transition-transform" />
              </div>
              <h4 className="text-sm font-bold text-slate-200 group-hover:text-white">Real Estate Housing</h4>
              <p className="text-xs text-slate-400 mt-1">
                600 property listings with sqft, rooms, neighborhoods &amp; sale prices.
              </p>
            </button>

            <button
              onClick={() => handleLaunchSample('segmentation')}
              className="p-4 rounded-xl bg-slate-900/80 hover:bg-slate-850 border border-slate-800 hover:border-purple-500/50 text-left transition group"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800/50">
                  Clustering
                </span>
                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-purple-400 group-hover:translate-x-0.5 transition-transform" />
              </div>
              <h4 className="text-sm font-bold text-slate-200 group-hover:text-white">Customer Clusters</h4>
              <p className="text-xs text-slate-400 mt-1">
                500 retail customer profiles with income, spend score &amp; basket metrics.
              </p>
            </button>
          </div>
        </div>
      </section>

      {/* Feature Capabilities Grid */}
      <section className="py-16 px-4 md:px-6 max-w-6xl mx-auto border-t border-slate-800/80">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-100 mb-3">
            A Complete End-to-End Analytics Workflow
          </h2>
          <p className="text-sm text-slate-400">
            From raw messy files to clean data, interactive visualizations, predictive models, and Gemini AI insights.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800">
            <div className="w-10 h-10 rounded-xl bg-indigo-950 border border-indigo-800 flex items-center justify-center text-indigo-400 mb-4">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-200 mb-2">Automated Profiling &amp; Quality</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Instant calculation of descriptive stats, IQR outliers, null counts, duplicate rows, and documented 0-100 data health grading.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800">
            <div className="w-10 h-10 rounded-xl bg-teal-950 border border-teal-800 flex items-center justify-center text-teal-400 mb-4">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-200 mb-2">Interactive Cleaning Studio</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Impute missing values, treat outliers with Winsorization, cast types, rename columns, and preview before/after diffs with zero raw data loss.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800">
            <div className="w-10 h-10 rounded-xl bg-blue-950 border border-blue-800 flex items-center justify-center text-blue-400 mb-4">
              <BarChart3 className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-200 mb-2">Exploratory Visualizations (EDA)</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Plotly-powered interactive histograms, grouped box plots, 2D scatter plots, and Pearson correlation matrices with hover tooltips.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800">
            <div className="w-10 h-10 rounded-xl bg-purple-950 border border-purple-800 flex items-center justify-center text-purple-400 mb-4">
              <Cpu className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-200 mb-2">Machine Learning Pipelines</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Train Scikit-Learn classification, regression, and clustering pipelines with train/test validation, confusion matrices, and live prediction simulator.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800">
            <div className="w-10 h-10 rounded-xl bg-emerald-950 border border-emerald-800 flex items-center justify-center text-emerald-400 mb-4">
              <Bot className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-200 mb-2">Google Gemini AI Assistant</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Domain-aware AI consultant grounded in calculated dataset statistics that interprets correlations without hallucinating findings.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800">
            <div className="w-10 h-10 rounded-xl bg-amber-950 border border-amber-800 flex items-center justify-center text-amber-400 mb-4">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-200 mb-2">Executive PDF Reports &amp; Exports</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              One-click downloadable ReportLab PDF analytics reports, cleaned CSV downloads, and batch model prediction exports.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-slate-900 text-center text-xs text-slate-500">
        <p>© 2025 DataPilot AI. Automated Data Analytics &amp; Machine Learning Platform.</p>
      </footer>
    </div>
  );
};
