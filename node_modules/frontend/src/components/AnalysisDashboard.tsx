import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell 
} from 'recharts';
import { FileText, Award, BarChart3, TrendingUp } from 'lucide-react';

interface Entity {
  name: string;
  type: string;
}

interface ChartData {
  chartType: 'bar' | 'line' | 'pie';
  title: string;
  xAxis: string;
  yAxis: string;
  data: Array<Record<string, any>>;
}

interface AnalysisData {
  id: string;
  fileName: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  summary?: string;
  entities?: Entity[];
  sentiment?: string;
  visualizations?: ChartData[];
}

interface AnalysisDashboardProps {
  document: AnalysisData | null;
}

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4'];

export const AnalysisDashboard: React.FC<AnalysisDashboardProps> = ({ document }) => {
  if (!document) {
    return (
      <div className="panel flex flex-col items-center justify-center text-center py-20">
        <FileText size={48} className="text-slate-600 mb-4" />
        <h3 className="text-xl font-bold text-slate-300">No Document Selected</h3>
        <p className="text-slate-500 text-sm mt-2 max-w-sm">
          Select an active document from the sidebar list, or upload a new one to view automated multimodal insights.
        </p>
      </div>
    );
  }

  if (document.status === 'PENDING' || document.status === 'PROCESSING') {
    return (
      <div className="panel flex flex-col items-center justify-center text-center py-20">
        <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4"></div>
        <h3 className="text-xl font-bold text-slate-300">Analyzing Document</h3>
        <p className="text-slate-500 text-sm mt-2 max-w-sm">
          Gemini is transcribing media tracks, extracting textual layouts, and generating structured reports...
        </p>
      </div>
    );
  }

  if (document.status === 'FAILED') {
    return (
      <div className="panel flex flex-col items-center justify-center text-center py-20 border-red-900/40">
        <FileText size={48} className="text-red-500 mb-4" />
        <h3 className="text-xl font-bold text-red-400">Processing Failed</h3>
        <p className="text-slate-500 text-sm mt-2 max-w-sm">
          An error occurred while parsing the file content. Ensure the file contains valid media data or document text.
        </p>
      </div>
    );
  }

  return (
    <div className="dashboard-grid">
      {/* Document Meta & Summary */}
      <div className="panel summary-card">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-extrabold text-2xl text-slate-100 font-display">
            {document.fileName}
          </h2>
          <span className="badge badge-completed">Analysis Ready</span>
        </div>
        
        <div className="mb-6">
          <h4 className="text-xs uppercase text-slate-500 font-bold tracking-wider mb-2">Summary Insights</h4>
          <p className="summary-text">{document.summary}</p>
        </div>

        <div className="grid grid-cols-2 gap-4 border-t border-slate-800/80 pt-4">
          <div>
            <h4 className="text-xs uppercase text-slate-500 font-bold tracking-wider mb-2">Sentiment Profile</h4>
            <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
              document.sentiment?.toUpperCase() === 'POSITIVE' ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/50' :
              document.sentiment?.toUpperCase() === 'NEGATIVE' ? 'bg-red-950/40 text-red-400 border border-red-800/50' :
              'bg-slate-800/40 text-slate-300 border border-slate-700/50'
            }`}>
              {document.sentiment || 'NEUTRAL'}
            </span>
          </div>
          <div>
            <h4 className="text-xs uppercase text-slate-500 font-bold tracking-wider mb-2">Source Type</h4>
            <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-blue-950/40 text-blue-400 border border-blue-800/50">
              {document.fileName.split('.').pop()?.toUpperCase() || 'DOCUMENT'}
            </span>
          </div>
        </div>
      </div>

      {/* Named Entities Panel */}
      {document.entities && document.entities.length > 0 && (
        <div className="panel">
          <h3 className="panel-title">
            <Award size={18} /> Extracted Entities
          </h3>
          <div className="entities-container">
            {document.entities.map((entity, i) => (
              <span key={i} className="entity-tag">
                <span className="text-slate-200 font-medium">{entity.name}</span>
                <span className="entity-tag-type">{entity.type}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Visualizations Charts Panel */}
      {document.visualizations && document.visualizations.length > 0 && (
        <div className="panel">
          <h3 className="panel-title">
            <BarChart3 size={18} /> Document Visualizations
          </h3>
          
          <div className="flex flex-col gap-8 mt-4">
            {document.visualizations.map((chart, idx) => (
              <div key={idx} className="border-b border-slate-800/60 pb-8 last:border-0 last:pb-0">
                <h4 className="font-semibold text-slate-200 mb-4 flex items-center gap-2">
                  <TrendingUp size={16} className="text-violet-400" /> {chart.title}
                </h4>
                
                <div className="h-64 w-full bg-slate-950/40 border border-slate-800/40 rounded-xl p-4">
                  <ResponsiveContainer width="100%" height="100%">
                    {chart.chartType === 'bar' ? (
                      <BarChart data={chart.data}>
                        <XAxis dataKey={chart.xAxis} stroke="#6b7280" fontSize={11} tickLine={false} />
                        <YAxis stroke="#6b7280" fontSize={11} tickLine={false} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#111827', borderColor: '#1f2937', borderRadius: '8px' }}
                          labelStyle={{ color: '#f3f4f6' }}
                        />
                        <Legend />
                        <Bar dataKey={chart.yAxis} fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    ) : chart.chartType === 'line' ? (
                      <LineChart data={chart.data}>
                        <XAxis dataKey={chart.xAxis} stroke="#6b7280" fontSize={11} tickLine={false} />
                        <YAxis stroke="#6b7280" fontSize={11} tickLine={false} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#111827', borderColor: '#1f2937', borderRadius: '8px' }}
                          labelStyle={{ color: '#f3f4f6' }}
                        />
                        <Legend />
                        <Line type="monotone" dataKey={chart.yAxis} stroke="#8b5cf6" strokeWidth={2.5} activeDot={{ r: 6 }} />
                      </LineChart>
                    ) : (
                      <PieChart>
                        <Pie
                          data={chart.data}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey={chart.yAxis}
                          nameKey={chart.xAxis}
                          label
                        >
                          {chart.data.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#111827', borderColor: '#1f2937', borderRadius: '8px' }}
                          labelStyle={{ color: '#f3f4f6' }}
                        />
                        <Legend />
                      </PieChart>
                    )}
                  </ResponsiveContainer>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
