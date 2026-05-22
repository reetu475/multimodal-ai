import React, { useState, useRef } from 'react';
import { UploadCloud, AlertCircle } from 'lucide-react';
import axios from 'axios';

interface FileUploadProps {
  onUploadSuccess: (docId: string) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onUploadSuccess }) => {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processFile = async (file: File) => {
    // Basic file size limits for prototype (100MB)
    if (file.size > 100 * 1024 * 1024) {
      setError("File is too large. Maximum size is 100MB.");
      return;
    }

    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post('/api/v1/documents/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data && response.data.documentId) {
        onUploadSuccess(response.data.documentId);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || "Failed to upload file. Make sure backend is running.");
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const onButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="panel">
      <h3 className="panel-title">
        <UploadCloud size={18} /> Ingest Document
      </h3>
      
      <div 
        className={`upload-zone ${dragActive ? 'active' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={onButtonClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          style={{ display: 'none' }}
          onChange={handleChange}
          accept=".txt,.md,.pdf,.docx,image/*,audio/*,video/*"
        />
        
        <UploadCloud className="upload-icon" />
        
        {uploading ? (
          <div>
            <p className="font-semibold text-slate-200">Uploading asset...</p>
            <p className="text-xs text-slate-400 mt-1">Delegating queue process...</p>
          </div>
        ) : (
          <div>
            <p className="font-semibold text-slate-200">Drag & Drop file here</p>
            <p className="text-xs text-slate-400 mt-1">
              Supports PDF, DOCX, Text, Images, Audio, Video (Max 100MB)
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-3 p-3 rounded-lg bg-red-950/30 border border-red-900/50 flex gap-2 items-center text-xs text-red-400">
          <AlertCircle size={14} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};
