"use client";
import React, { useEffect, useState } from "react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  deleteDoc,
  doc,
  updateDoc,
  where,
} from "firebase/firestore";
import { deleteObject, ref, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase";
import { FileMetadata } from "../types/file";
import QRCode from "qrcode";
import { format } from "date-fns";
import { toast } from "react-hot-toast";

const FileList: React.FC = () => {
  const [files, setFiles] = useState<FileMetadata[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileMetadata | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, "files"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fileList: FileMetadata[] = [];
      snapshot.forEach((doc) => {
        fileList.push({ id: doc.id, ...doc.data() } as FileMetadata);
      });
      setFiles(fileList);
    });

    return () => unsubscribe();
  }, []);

  const handleDelete = async (file: FileMetadata) => {
    try {
      setIsDeleting(file.id);

      if (file.storagePath) {
        const storageRef = ref(storage, file.storagePath);
        await deleteObject(storageRef);
      }

      await deleteDoc(doc(db, "files", file.id));
      toast.success("File deleted successfully");
    } catch (error) {
      console.error("Error deleting file:", error);
      setError(`Failed to delete file: ${(error as Error).message}`);
      toast.error("Failed to delete file");
    } finally {
      setIsDeleting(null);
    }
  };

  const handlePreview = async (file: FileMetadata) => {
    if (file.password) {
      setSelectedFile(file);
      setShowPasswordModal(true);
      return;
    }

    try {
      if (file.expiresAt && new Date(file.expiresAt) < new Date()) {
        toast.error("File has expired");
        return;
      }

      if (file.maxDownloads && file.downloadCount >= file.maxDownloads) {
        toast.error("Maximum download limit reached");
        return;
      }

      const storageRef = ref(storage, file.storagePath);
      const downloadURL = await getDownloadURL(storageRef);

      const tempLink = document.createElement("a");
      tempLink.href = downloadURL;

      const response = await fetch(downloadURL);
      if (!response.ok) {
        throw new Error(
          `Failed to fetch file: ${response.status} ${response.statusText}`
        );
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      setPreviewUrl(url);
      setSelectedFile(file);
      setShowPreviewModal(true);
    } catch (error) {
      console.error("Error previewing file:", error);
      setError(`Failed to preview file: ${(error as Error).message}`);
      toast.error("Failed to preview file. Please try downloading instead.");
    }
  };

  const handleDownload = async (file: FileMetadata) => {
    if (file.password) {
      setSelectedFile(file);
      setShowPasswordModal(true);
      return;
    }

    try {
      if (file.maxDownloads && file.downloadCount >= file.maxDownloads) {
        toast.error("Maximum download limit reached");
        return;
      }

      if (file.expiresAt && new Date(file.expiresAt) < new Date()) {
        toast.error("File has expired");
        return;
      }

      const storageRef = ref(storage, file.storagePath);
      const downloadURL = await getDownloadURL(storageRef);

      const response = await fetch(downloadURL);
      if (!response.ok) {
        throw new Error(
          `Failed to fetch file: ${response.status} ${response.statusText}`
        );
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      await updateDoc(doc(db, "files", file.id), {
        downloadCount: (file.downloadCount || 0) + 1,
      });

      toast.success("File downloaded successfully");
    } catch (error) {
      console.error("Error downloading file:", error);
      setError(`Failed to download file: ${(error as Error).message}`);
      toast.error("Failed to download file. Please try again later.");
    }
  };

  const handlePasswordSubmit = async () => {
    if (!selectedFile || !password) return;

    if (password === selectedFile.password) {
      setShowPasswordModal(false);
      setPassword("");
      setError("");
      if (showPreviewModal) {
        handlePreview(selectedFile);
      } else {
        handleDownload(selectedFile);
      }
    } else {
      setError("Incorrect password");
      toast.error("Incorrect password");
    }
  };

  const handleShowQR = (file: FileMetadata) => {
    setSelectedFile(file);
    setShowQRModal(true);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Link copied to clipboard");
  };

  const getPreviewComponent = (file: FileMetadata, url: string) => {
    if (file.type.startsWith("image/")) {
      return (
        <img
          src={url}
          alt={file.name}
          className="max-w-full max-h-[70vh] object-contain"
        />
      );
    } else if (file.type.startsWith("video/")) {
      return <video src={url} controls className="max-w-full max-h-[70vh]" />;
    } else if (file.type.startsWith("audio/")) {
      return <audio src={url} controls className="w-full" />;
    } else if (file.type === "application/pdf") {
      return <iframe src={url} className="w-full h-[70vh]" />;
    } else {
      return (
        <div className="text-center p-4">
          <p className="text-gray-300">
            Preview not available for this file type
          </p>
          <button
            onClick={() => handleDownload(file)}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Download Instead
          </button>
        </div>
      );
    }
  };

  const filteredFiles = files.filter(
    (file) =>
      file.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (file.description &&
        file.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="mt-8">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-white">Uploaded Files</h2>
        <input
          type="text"
          placeholder="Search files..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-800 text-white border-gray-700"
        />
      </div>
      {error && (
        <div className="mb-4 p-4 bg-red-900 text-red-200 rounded-lg">
          {error}
        </div>
      )}
      <div className="grid gap-4">
        {filteredFiles.map((file) => (
          <div
            key={file.id}
            className="bg-gray-900 p-4 rounded-lg shadow hover:shadow-md transition-shadow border border-gray-700"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h3 className="font-medium text-white">{file.name}</h3>
                {file.description && (
                  <p className="text-sm text-gray-300 mt-1">
                    {file.description}
                  </p>
                )}
                <p className="text-sm text-gray-400">
                  Size: {(file.size / (1024 * 1024)).toFixed(2)} MB
                </p>
                <p className="text-sm text-gray-400">
                  Uploaded: {format(new Date(file.createdAt), "PPp")}
                </p>
                {file.expiresAt && (
                  <p className="text-sm text-red-400">
                    Expires: {format(new Date(file.expiresAt), "PPp")}
                  </p>
                )}
                <p className="text-sm text-gray-400">
                  Downloads: {file.downloadCount || 0}
                  {file.maxDownloads && ` / ${file.maxDownloads}`}
                </p>
                {file.password && (
                  <p className="text-sm text-blue-400">Password Protected</p>
                )}
                {file.customUrl && (
                  <p className="text-sm text-green-400">
                    Custom URL: {file.customUrl}
                  </p>
                )}
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => handlePreview(file)}
                  className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
                  disabled={isDeleting === file.id}
                >
                  Preview
                </button>
                <button
                  onClick={() => handleDownload(file)}
                  className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                  disabled={isDeleting === file.id}
                >
                  Download
                </button>
                <button
                  onClick={() => handleShowQR(file)}
                  className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  QR Code
                </button>
                <button
                  onClick={() => handleDelete(file)}
                  className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                  disabled={isDeleting === file.id}
                >
                  {isDeleting === file.id ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Password Modal */}
      {showPasswordModal && selectedFile && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center">
          <div className="bg-gray-900 p-6 rounded-lg w-96 border border-gray-700">
            <h3 className="text-lg font-medium mb-4 text-white">
              Enter Password
            </h3>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-2 border rounded mb-4 bg-gray-800 text-white border-gray-700"
              placeholder="Enter file password"
            />
            {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  setPassword("");
                  setError("");
                }}
                className="px-4 py-2 text-gray-400 hover:text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handlePasswordSubmit}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreviewModal && selectedFile && previewUrl && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center">
          <div className="bg-gray-900 p-6 rounded-lg max-w-4xl w-full mx-4 border border-gray-700">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-white">
                {selectedFile.name}
              </h3>
              <button
                onClick={() => {
                  setShowPreviewModal(false);
                  setPreviewUrl(null);
                  URL.revokeObjectURL(previewUrl);
                }}
                className="text-gray-400 hover:text-gray-300"
              >
                Close
              </button>
            </div>
            <div className="bg-gray-800 p-4 rounded-lg">
              {getPreviewComponent(selectedFile, previewUrl)}
            </div>
            <div className="mt-4 flex justify-end space-x-2">
              <button
                onClick={() => handleDownload(selectedFile)}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Download
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {showQRModal && selectedFile && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center">
          <div className="bg-gray-900 p-6 rounded-lg w-96 border border-gray-700">
            <h3 className="text-lg font-medium mb-4 text-white">QR Code</h3>
            <div className="flex flex-col items-center">
              <img
                src={selectedFile.qrCode}
                alt="QR Code"
                className="w-48 h-48 mb-4 bg-white p-2 rounded"
              />
              <p className="text-sm text-gray-300 mb-2">
                Scan to download: {selectedFile.name}
              </p>
              <button
                onClick={() =>
                  copyToClipboard(
                    `${window.location.origin}/download/${selectedFile.customUrl}`
                  )
                }
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Copy Link
              </button>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setShowQRModal(false)}
                className="px-4 py-2 text-gray-400 hover:text-gray-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileList;
