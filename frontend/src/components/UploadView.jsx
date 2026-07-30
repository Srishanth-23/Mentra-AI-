import React, { useState } from 'react';
import { ingestDocument } from '../api';
import LoadingIndicator from './LoadingIndicator';
import { getUIText } from '../ui_translations';

export default function UploadView({ onIngestSuccess, preferredLanguage = 'en' }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError('');
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setError('');
    }
  };

  const handleIngest = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a PDF or TXT study material file to upload.');
      return;
    }

    setLoading(true);
    setError('');
    setStatusMsg('Ingesting source materials & extracting chunks...');

    try {
      setTimeout(() => setStatusMsg('Building vector embeddings in FAISS index...'), 1500);
      setTimeout(() => setStatusMsg('Auto-extracting core concepts & prerequisite graph...'), 3500);

      const data = await ingestDocument(file);
      onIngestSuccess(data);
    } catch (err) {
      setError(err.message || 'Error processing document. Ensure backend server is running.');
    } finally {
      setLoading(false);
      setStatusMsg('');
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-body py-8 px-4 md:px-12 max-w-container-max-width mx-auto w-full">
      {/* Headline Section */}
      <section className="text-center mt-6 mb-10 space-y-4">
        <h1 className="font-heading text-3xl font-semibold leading-tight text-primary max-w-2xl mx-auto">
          {getUIText(preferredLanguage, 'upload_title')}
        </h1>
        <p className="font-body text-base leading-normal text-secondary max-w-xl mx-auto">
          {getUIText(preferredLanguage, 'upload_subtitle')}
        </p>
      </section>

      {/* Upload Card Centerpiece */}
      <div
        id="drop-zone"
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        className={`w-full max-w-2xl mx-auto bg-surface-container-lowest border border-outline-variant/30 rounded-lg p-1 transition-all duration-300 ${
          isDragOver ? 'scale-[1.02] bg-surface-container-high' : ''
        }`}
      >
        <form onSubmit={handleIngest}>
          <div className="upload-dashed rounded-lg p-10 md:p-16 flex flex-col items-center justify-center text-center group cursor-pointer">
            <input
              type="file"
              accept=".pdf,.txt"
              onChange={handleFileChange}
              className="hidden"
              id="file-upload"
            />
            <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center justify-center w-full">
              <div className="w-16 h-16 rounded-full bg-surface-container-low flex items-center justify-center mb-5 group-hover:scale-105 transition-transform duration-300">
                <span className="material-symbols-outlined text-primary text-3xl" data-icon="description">
                  description
                </span>
              </div>

              <h3 className="font-body text-lg font-medium text-primary mb-2">
                {file ? file.name : getUIText(preferredLanguage, 'upload_drag')}
              </h3>
              <p className="font-mono text-xs text-outline uppercase tracking-wide">
                {getUIText(preferredLanguage, 'upload_limit')}
              </p>
            </label>

            {loading && (
              <div className="mt-6 w-full max-w-md mx-auto">
                <LoadingIndicator text={statusMsg} />
              </div>
            )}

            {error && (
              <div className="mt-4 p-3 rounded bg-error-container text-on-error-container text-xs font-mono">
                ⚠️ {error}
              </div>
            )}

            <div className="mt-6 flex flex-col sm:flex-row items-center gap-3">
              <label
                htmlFor="file-upload"
                className="px-6 py-2.5 bg-[#E7E0D3] hover:bg-[#DDD5C7] text-[#2C221E] border border-[#CFC4B2] font-medium rounded-xl cursor-pointer text-sm font-body transition-all"
              >
                {getUIText(preferredLanguage, 'select_files')}
              </label>

              <button
                type="submit"
                disabled={loading || !file}
                className={`px-8 py-2.5 bg-[#2C221E] text-[#FFFDF7] font-medium rounded-xl hover:bg-[#3D322B] active:scale-95 transition-all text-sm font-body shadow-sm ${
                  loading || !file ? 'opacity-40 cursor-not-allowed shadow-none' : ''
                }`}
              >
                {loading ? getUIText(preferredLanguage, 'ingesting') : getUIText(preferredLanguage, 'start_extraction')}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Progress Steps */}
      <section className="w-full max-w-3xl mx-auto mt-16 mb-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative">
          {/* Step 1 */}
          <div className="flex flex-col items-center md:items-start text-center md:text-left group">
            <div className="w-8 h-8 rounded-full border border-outline/30 flex items-center justify-center mb-3 text-outline font-mono text-xs group-hover:border-primary group-hover:text-primary transition-colors">
              1
            </div>
            <span className="material-symbols-outlined text-primary mb-2 text-xl" data-icon="upload_file">upload_file</span>
            <h4 className="font-heading text-lg font-semibold text-primary mb-1">Upload</h4>
            <p className="text-sm leading-normal text-secondary font-body">Ingest source materials for grounding.</p>
          </div>

          {/* Step 2 */}
          <div className="flex flex-col items-center md:items-start text-center md:text-left group">
            <div className="w-8 h-8 rounded-full border border-outline/30 flex items-center justify-center mb-3 text-outline font-mono text-xs group-hover:border-primary group-hover:text-primary transition-colors">
              2
            </div>
            <span className="material-symbols-outlined text-primary mb-2 text-xl" data-icon="account_tree">account_tree</span>
            <h4 className="font-heading text-lg font-semibold text-primary mb-1">Extract concepts</h4>
            <p className="text-sm leading-normal text-secondary font-body">Map the structure of your data.</p>
          </div>

          {/* Step 3 */}
          <div className="flex flex-col items-center md:items-start text-center md:text-left group">
            <div className="w-8 h-8 rounded-full border border-outline/30 flex items-center justify-center mb-3 text-outline font-mono text-xs group-hover:border-primary group-hover:text-primary transition-colors">
              3
            </div>
            <span className="material-symbols-outlined text-primary mb-2 text-xl" data-icon="quiz">quiz</span>
            <h4 className="font-heading text-lg font-semibold text-primary mb-1">Ask & quiz</h4>
            <p className="text-sm leading-normal text-secondary font-body">Test recall with grounded evidence.</p>
          </div>

          {/* Step 4 */}
          <div className="flex flex-col items-center md:items-start text-center md:text-left group">
            <div className="w-8 h-8 rounded-full border border-outline/30 flex items-center justify-center mb-3 text-outline font-mono text-xs group-hover:border-primary group-hover:text-primary transition-colors">
              4
            </div>
            <span className="material-symbols-outlined text-primary mb-2 text-xl" data-icon="assignment_turned_in">assignment_turned_in</span>
            <h4 className="font-heading text-lg font-semibold text-primary mb-1">Recovery plan</h4>
            <p className="text-sm leading-normal text-secondary font-body">Shore up gaps in your knowledge.</p>
          </div>
        </div>
      </section>

      {/* Footer Note */}
      <footer className="w-full py-8 flex flex-col items-center border-t border-outline-variant/15 mt-auto">
        <p className="font-mono text-xs text-secondary mb-2 uppercase tracking-wide">Your file stays private — delete anytime</p>
        <div className="flex gap-2 opacity-50">
          <span className="w-1.5 h-1.5 rounded-full bg-outline"></span>
          <span className="w-1.5 h-1.5 rounded-full bg-outline"></span>
          <span className="w-1.5 h-1.5 rounded-full bg-outline"></span>
        </div>
      </footer>
    </div>
  );
}
