// src/App.js
import React, { useState } from 'react';
import FileUpload from './components/FileUpload';
import UploadedFiles from './components/UploadedFiles';
import './index.css';

const App = () => {
  const [uploadedFiles, setUploadedFiles] = useState([]);

  const handleFilesUpload = (newFiles) => {
    setUploadedFiles([...uploadedFiles, ...newFiles]);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <FileUpload onUpload={handleFilesUpload} />
      <UploadedFiles files={uploadedFiles} />
    </div>
  );
};

export default App;
