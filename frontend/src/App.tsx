import React, { useState, useEffect } from 'react';
import { FileUpload } from './components/FileUpload';
import { AnalysisDashboard } from './components/AnalysisDashboard';
import { ChatInterface } from './components/ChatInterface';
import { Activity, Trash2, ListFilter, Cpu } from 'lucide-react';
import axios from 'axios';

interface Document {
  id: string;
  fileName: string;
  mimeType: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  progress: number;
  createdAt: string;
}

const App: React.FC = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [activeDocumentDetails, setActiveDocumentDetails] = useState<any>(null);

  // Fetch document lists
  const fetchDocuments = async () => {
    try {
      const response = await axios.get('/api/v1/documents');
      setDocuments(response.data);
    } catch (error) {
      console.error('Failed to fetch documents:', error);
    }
  };

  // Poll for document progress if any document is in PENDING/PROCESSING status
  useEffect(() => {
    fetchDocuments();
    const interval = setInterval(() => {
      const containsActiveJob = documents.some(
        (doc) => doc.status === 'PENDING' || doc.status === 'PROCESSING'
      );
      if (containsActiveJob) {
        fetchDocuments();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [documents]);

  // Fetch active document details (synthesis summary, charts, entities)
  useEffect(() => {
    if (!activeDocId) {
      setActiveDocumentDetails(null);
      return;
    }

    const fetchDetails = async () => {
      try {
        const response = await axios.get(`/api/v1/documents/${activeDocId}/analysis`);
        // If selected document status changes, we update list also
        const docInList = documents.find(d => d.id === activeDocId);
        setActiveDocumentDetails({
          id: response.data.documentId,
          fileName: docInList ? docInList.fileName : 'Document Analysis',
          status: response.data.status,
          summary: response.data.summary,
          entities: response.data.entities,
          sentiment: response.data.sentiment,
          visualizations: response.data.visualizations,
        });
      } catch (error) {
        console.error('Failed to fetch analysis details:', error);
      }
    };

    fetchDetails();
    
    // Set up polling for active analysis if it's currently processing
    const activeDoc = documents.find((d) => d.id === activeDocId);
    if (activeDoc && (activeDoc.status === 'PENDING' || activeDoc.status === 'PROCESSING')) {
      const detailsInterval = setInterval(fetchDetails, 3000);
      return () => clearInterval(detailsInterval);
    }
  }, [activeDocId, documents]);

  const handleUploadSuccess = (docId: string) => {
    fetchDocuments();
    setActiveDocId(docId);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this document and all its indexed vector embeddings?')) {
      return;
    }
    
    try {
      await axios.delete(`/api/v1/documents/${id}`);
      if (activeDocId === id) {
        setActiveDocId(null);
      }
      fetchDocuments();
    } catch (error) {
      console.error('Failed to delete document:', error);
    }
  };

  return (
    <div className="app-container">
      <header className="header">
        <div className="logo-container">
          <Cpu className="logo-icon animate-pulse" />
          <h1 className="logo-text">Multimodal Insight</h1>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-950/60 px-3 py-1.5 rounded-full border border-slate-800">
          <Activity size={12} className="text-emerald-400" />
          <span>ChromaDB Cloud & Gemini Engine Active</span>
        </div>
      </header>

      <main className="main-content">
        {/* Sidebar */}
        <aside className="sidebar">
          {/* File Upload zone */}
          <FileUpload onUploadSuccess={handleUploadSuccess} />

          {/* List panel */}
          <div className="panel flex-1">
            <h3 className="panel-title">
              <ListFilter size={18} /> Document Corpus
            </h3>
            
            <div className="doc-list">
              {documents.length === 0 ? (
                <div className="text-center text-slate-500 text-xs py-8">
                  No documents uploaded yet.
                </div>
              ) : (
                documents.map((doc) => (
                  <div
                    key={doc.id}
                    className={`doc-item ${activeDocId === doc.id ? 'active' : ''}`}
                    onClick={() => setActiveDocId(doc.id)}
                  >
                    <div className="doc-header">
                      <span className="doc-name font-semibold" title={doc.fileName}>
                        {doc.fileName}
                      </span>
                      <button 
                        className="text-slate-500 hover:text-red-400 p-0.5 rounded transition-colors"
                        onClick={(e) => handleDelete(e, doc.id)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>

                    <div className="flex justify-between items-center text-[11px] text-slate-400 mt-1">
                      <span>{doc.mimeType.split('/').pop()?.toUpperCase()}</span>
                      <span className={`badge badge-${doc.status.toLowerCase()}`}>
                        {doc.status}
                      </span>
                    </div>

                    {(doc.status === 'PENDING' || doc.status === 'PROCESSING') && (
                      <div className="mt-2">
                        <div className="progress-bar-bg">
                          <div 
                            className="progress-bar-fill" 
                            style={{ width: `${doc.progress}%` }}
                          ></div>
                        </div>
                        <div className="text-[10px] text-slate-500 text-right mt-1">
                          Processing: {doc.progress}%
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>

        {/* Dashboard Grid */}
        <section className="flex flex-col gap-6">
          {/* Active Insights */}
          <AnalysisDashboard document={activeDocumentDetails} />
          
          {/* Conversational Engine */}
          <ChatInterface activeDocumentId={activeDocId} />
        </section>
      </main>
    </div>
  );
};

export default App;
