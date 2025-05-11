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
} from "firebase/firestore";
import { deleteObject, ref, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase";
import { FileMetadata } from "../types/file";
import { format } from "date-fns";
import { toast } from "react-hot-toast";
import Image from "next/image";

const FileList: React.FC = () => {
  const [files, setFiles] = useState<FileMetadata[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileMetadata | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadingStates, setLoadingStates] = useState<{
    [key: string]: { preview: boolean; download: boolean };
  }>({});
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);

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

  const handlePasswordSubmit = async () => {
    if (!selectedFile || !password) return;

    try {
      setIsSubmittingPassword(true);
      if (password === selectedFile.password) {
        setShowPasswordModal(false);
        setPassword("");
        setError("");

        // Get a fresh download URL
        const storageRef = ref(storage, selectedFile.storagePath);
        const downloadURL = await getDownloadURL(storageRef);
        const proxyUrl = `/api/proxy?url=${encodeURIComponent(downloadURL)}`;

        if (showPreviewModal) {
          // Handle preview
          const response = await fetch(proxyUrl);
          if (!response.ok) {
            throw new Error(
              `Failed to fetch file: ${response.status} ${response.statusText}`
            );
          }

          const blob = await response.blob();
          const objectUrl = window.URL.createObjectURL(blob);
          setPreviewUrl(objectUrl);
          setSelectedFile(selectedFile);
          setShowPreviewModal(true);
        } else {
          // Handle download
          const response = await fetch(proxyUrl);
          if (!response.ok) {
            throw new Error(
              `Failed to fetch file: ${response.status} ${response.statusText}`
            );
          }

          const blob = await response.blob();
          const objectUrl = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = objectUrl;
          a.download = selectedFile.name;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(objectUrl);
          document.body.removeChild(a);

          // Update download count
          await updateDoc(doc(db, "files", selectedFile.id), {
            downloadCount: (selectedFile.downloadCount || 0) + 1,
          });

          toast.success("File downloaded successfully");
        }
      } else {
        setError("Incorrect password");
        toast.error("Incorrect password");
      }
    } catch (error) {
      console.error("Error handling password-protected file:", error);
      setError(`Failed to access file: ${(error as Error).message}`);
      toast.error("Failed to access file. Please try again.");
    } finally {
      setIsSubmittingPassword(false);
    }
  };

  const handlePreview = async (file: FileMetadata) => {
    if (file.password) {
      setSelectedFile(file);
      setShowPreviewModal(true);
      setShowPasswordModal(true);
      return;
    }

    try {
      setLoadingStates((prev) => ({
        ...prev,
        [file.id]: { ...prev[file.id], preview: true },
      }));

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
      const proxyUrl = `/api/proxy?url=${encodeURIComponent(downloadURL)}`;

      const response = await fetch(proxyUrl);
      if (!response.ok) {
        throw new Error(
          `Failed to fetch file: ${response.status} ${response.statusText}`
        );
      }

      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      setPreviewUrl(objectUrl);
      setSelectedFile(file);
      setShowPreviewModal(true);
    } catch (error) {
      console.error("Error previewing file:", error);
      setError(`Failed to preview file: ${(error as Error).message}`);
      toast.error("Failed to preview file. Please try downloading instead.");
    } finally {
      setLoadingStates((prev) => ({
        ...prev,
        [file.id]: { ...prev[file.id], preview: false },
      }));
    }
  };

  const handleDownload = async (file: FileMetadata) => {
    if (file.password) {
      setSelectedFile(file);
      setShowPreviewModal(false);
      setShowPasswordModal(true);
      return;
    }

    try {
      setLoadingStates((prev) => ({
        ...prev,
        [file.id]: { ...prev[file.id], download: true },
      }));

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
      const proxyUrl = `/api/proxy?url=${encodeURIComponent(downloadURL)}`;

      const response = await fetch(proxyUrl);
      if (!response.ok) {
        throw new Error(
          `Failed to fetch file: ${response.status} ${response.statusText}`
        );
      }

      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(objectUrl);
      document.body.removeChild(a);

      await updateDoc(doc(db, "files", file.id), {
        downloadCount: (file.downloadCount || 0) + 1,
      });

      toast.success("File downloaded successfully");
    } catch (error) {
      console.error("Error downloading file:", error);
      setError(`Failed to download file: ${(error as Error).message}`);
      toast.error("Failed to download file. Please try again later.");
    } finally {
      setLoadingStates((prev) => ({
        ...prev,
        [file.id]: { ...prev[file.id], download: false },
      }));
    }
  };

  const getPreviewComponent = (file: FileMetadata, url: string) => {
    if (file.type.startsWith("image/")) {
      return (
        <div className="relative w-full h-[70vh]">
          <Image
            src={url}
            alt={file.name}
            fill
            className="object-contain"
            unoptimized
          />
        </div>
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
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => handlePreview(file)}
                  disabled={
                    loadingStates[file.id]?.preview || isDeleting === file.id
                  }
                  className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 flex items-center space-x-2 min-w-[100px] justify-center"
                >
                  {loadingStates[file.id]?.preview ? (
                    <>
                      <svg
                        className="animate-spin h-4 w-4 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      <span>Loading...</span>
                    </>
                  ) : (
                    "Preview"
                  )}
                </button>
                <button
                  onClick={() => handleDownload(file)}
                  disabled={
                    loadingStates[file.id]?.download || isDeleting === file.id
                  }
                  className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2 min-w-[100px] justify-center"
                >
                  {loadingStates[file.id]?.download ? (
                    <>
                      <svg
                        className="animate-spin h-4 w-4 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      <span>Loading...</span>
                    </>
                  ) : (
                    "Download"
                  )}
                </button>
                <button
                  onClick={() => handleDelete(file)}
                  disabled={isDeleting === file.id}
                  className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                >
                  {isDeleting === file.id ? (
                    <div className="flex items-center space-x-2">
                      <svg
                        className="animate-spin h-4 w-4 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      <span>Deleting...</span>
                    </div>
                  ) : (
                    "Delete"
                  )}
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
              disabled={isSubmittingPassword}
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
                disabled={isSubmittingPassword}
              >
                Cancel
              </button>
              <button
                onClick={handlePasswordSubmit}
                disabled={isSubmittingPassword}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2 min-w-[100px] justify-center"
              >
                {isSubmittingPassword ? (
                  <>
                    <svg
                      className="animate-spin h-4 w-4 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    <span>Loading...</span>
                  </>
                ) : (
                  "Submit"
                )}
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
    </div>
  );
};

export default FileList;
