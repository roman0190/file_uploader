"use client";
import React, { useState, useRef } from "react";
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  UploadTask,
} from "firebase/storage";
import { collection, addDoc } from "firebase/firestore";
import { storage, db } from "../firebase";
import { nanoid } from "nanoid";
import Image from "next/image";

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

interface AllowedFileTypes {
  [key: string]: string[];
}

const ALLOWED_FILE_TYPES: AllowedFileTypes = {
  "image/*": ["jpg", "jpeg", "png", "gif", "webp"],
  "application/pdf": ["pdf"],
  "application/msword": ["doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    "docx",
  ],
  "application/vnd.ms-excel": ["xls"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ["xlsx"],
  "text/plain": ["txt"],
  "application/zip": ["zip"],
  "video/*": ["mp4", "webm", "mov"],
  "audio/*": ["mp3", "wav", "ogg"],
};

interface FileOptions {
  password?: string;
  expiresAt?: string;
  maxDownloads?: number | null;
  customUrl?: string;
  description?: string;
}

interface FileMetadata {
  name: string;
  url: string;
  storagePath: string;
  size: number;
  type: string;
  createdAt: string;
  downloadCount: number;
  customUrl: string;
  description: string;
  maxDownloads: number | null;
  password?: string;
  expiresAt?: string;
}

const FileUpload: React.FC = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<{
    [key: string]: number;
  }>({});
  const [errors, setErrors] = useState<{ [key: string]: string[] }>({});
  const [uploadTasks, setUploadTasks] = useState<{ [key: string]: UploadTask }>(
    {}
  );
  const [fileOptions, setFileOptions] = useState<{
    [key: string]: FileOptions;
  }>({});
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showPreview, setShowPreview] = useState<{ [key: string]: boolean }>(
    {}
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string[] => {
    const errors: string[] = [];

    if (file.size > MAX_FILE_SIZE) {
      errors.push(`File size exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit`);
    }

    const fileExtension = file.name.split(".").pop()?.toLowerCase() || "";
    const isValidType = Object.entries(ALLOWED_FILE_TYPES).some(
      ([mimeType, extensions]) => {
        if (mimeType.endsWith("/*")) {
          const baseType = mimeType.split("/")[0];
          return file.type.startsWith(baseType);
        }
        return extensions.includes(fileExtension);
      }
    );

    if (!isValidType) {
      errors.push("File type not allowed");
    }

    return errors;
  };

  const handleDrag = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragging(true);
    } else {
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    handleFiles(droppedFiles);
  };

  const handleFiles = async (selectedFiles: File[]): Promise<void> => {
    const newFiles: File[] = [];
    const newErrors: { [key: string]: string[] } = {};

    selectedFiles.forEach((file) => {
      const fileErrors = validateFile(file);
      if (fileErrors.length > 0) {
        newErrors[file.name] = fileErrors;
      } else {
        newFiles.push(file);
      }
    });

    setErrors((prev) => ({ ...prev, ...newErrors }));
    if (newFiles.length > 0) {
      setFiles((prev) => [...prev, ...newFiles]);
      newFiles.forEach((file) => {
        setSelectedFile(file);
        setShowOptionsModal(true);
      });
    }
  };

  const handleOptionsSubmit = async (options: FileOptions) => {
    if (selectedFile) {
      setFileOptions((prev) => ({
        ...prev,
        [selectedFile.name]: options,
      }));
      await uploadFile(selectedFile, options);
      setShowOptionsModal(false);
      setSelectedFile(null);
    }
  };

  const uploadFile = async (
    file: File,
    options: FileOptions
  ): Promise<void> => {
    try {
      const timestamp = Date.now();
      const uniqueFileName = `${timestamp}-${file.name}`;
      const filePath = `uploads/${uniqueFileName}`;
      const customUrl = options.customUrl || nanoid(10);

      const storageRef = ref(storage, filePath);
      const uploadTask = uploadBytesResumable(storageRef, file);

      setUploadTasks((prev) => ({ ...prev, [file.name]: uploadTask }));

      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress =
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress((prev) => ({ ...prev, [file.name]: progress }));
        },
        (error) => {
          console.error("Upload error:", error);
          setErrors((prev) => ({
            ...prev,
            [file.name]: [
              ...(prev[file.name] || []),
              "Upload failed: " + error.message,
            ],
          }));
        },
        async () => {
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

            const metadata: FileMetadata = {
              name: file.name,
              url: downloadURL,
              storagePath: filePath,
              size: file.size,
              type: file.type,
              createdAt: new Date().toISOString(),
              downloadCount: 0,
              customUrl,
              description: options.description || "",
              maxDownloads: options.maxDownloads || null,
            };

            if (options.password) {
              metadata.password = options.password;
            }
            if (options.expiresAt) {
              metadata.expiresAt = options.expiresAt;
            }

            await addDoc(collection(db, "files"), metadata);
          } catch (error) {
            console.error("Error saving file metadata:", error);
            setErrors((prev) => ({
              ...prev,
              [file.name]: [
                ...(prev[file.name] || []),
                "Failed to save file metadata: " + (error as Error).message,
              ],
            }));
          }
        }
      );
    } catch (error) {
      console.error("Error starting upload:", error);
      setErrors((prev) => ({
        ...prev,
        [file.name]: [
          ...(prev[file.name] || []),
          "Failed to start upload: " + (error as Error).message,
        ],
      }));
    }
  };

  const cancelUpload = (fileName: string): void => {
    const task = uploadTasks[fileName];
    if (task) {
      task.cancel();
      setFiles((prev) => prev.filter((f) => f.name !== fileName));
      setUploadProgress((prev) => {
        const newProgress = { ...prev };
        delete newProgress[fileName];
        return newProgress;
      });
      setUploadTasks((prev) => {
        const newTasks = { ...prev };
        delete newTasks[fileName];
        return newTasks;
      });
    }
  };

  const removeFile = (fileName: string): void => {
    setFiles((prev) => prev.filter((f) => f.name !== fileName));
    setUploadProgress((prev) => {
      const newProgress = { ...prev };
      delete newProgress[fileName];
      return newProgress;
    });
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[fileName];
      return newErrors;
    });
  };

  const getFilePreview = (file: File): string | null => {
    if (file.type.startsWith("image/")) {
      return URL.createObjectURL(file);
    }
    return null;
  };

  const togglePreview = (fileName: string) => {
    setShowPreview((prev) => ({
      ...prev,
      [fileName]: !prev[fileName],
    }));
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      <div
        className={`border-2 border-dashed rounded-lg p-8 transition-all duration-200 ${
          isDragging
            ? "border-white bg-gray-800 scale-105"
            : "border-gray-600 hover:border-white bg-gray-900"
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={(e) => handleFiles(Array.from(e.target.files || []))}
          multiple
          className="hidden"
          accept={Object.keys(ALLOWED_FILE_TYPES).join(",")}
        />
        <div className="text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            stroke="currentColor"
            fill="none"
            viewBox="0 0 48 48"
          >
            <path
              d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <p className="mt-1 text-sm text-gray-300">
            Drag and drop your files here, or click to select files
          </p>
          <p className="mt-1 text-xs text-gray-400">
            Max file size: {MAX_FILE_SIZE / (1024 * 1024)}MB
          </p>
        </div>
      </div>

      {files.length > 0 && (
        <div className="mt-4 space-y-4">
          {files.map((file) => (
            <div
              key={file.name}
              className="bg-gray-900 p-4 rounded-lg shadow transition-all duration-200 hover:shadow-md border border-gray-700"
            >
              <div className="flex items-start space-x-4">
                {file.type.startsWith("image/") && (
                  <div className="relative w-16 h-16 flex-shrink-0">
                    <Image
                      src={getFilePreview(file) || ""}
                      alt={file.name}
                      fill
                      className="object-cover rounded cursor-pointer"
                      onClick={() => togglePreview(file.name)}
                      unoptimized
                    />
                  </div>
                )}
                <div className="flex-grow">
                  <div className="flex justify-between items-start mb-1">
                    <div>
                      <span className="text-sm font-medium text-white">
                        {file.name}
                      </span>
                      <span className="text-xs text-gray-400 ml-2">
                        {(file.size / (1024 * 1024)).toFixed(2)} MB
                      </span>
                    </div>
                    <div className="flex space-x-2">
                      {uploadProgress[file.name] < 100 && (
                        <button
                          onClick={() => cancelUpload(file.name)}
                          className="text-red-400 hover:text-red-300"
                        >
                          Cancel
                        </button>
                      )}
                      <button
                        onClick={() => removeFile(file.name)}
                        className="text-gray-400 hover:text-gray-300"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress[file.name] || 0}%` }}
                    />
                  </div>
                  {errors[file.name] && (
                    <div className="mt-1 text-xs text-red-400">
                      {errors[file.name].map((error, index) => (
                        <p key={index}>{error}</p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {showPreview[file.name] && file.type.startsWith("image/") && (
                <div className="mt-4 relative w-full h-96">
                  <Image
                    src={getFilePreview(file) || ""}
                    alt={file.name}
                    fill
                    className="object-contain rounded"
                    unoptimized
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* File Options Modal */}
      {showOptionsModal && selectedFile && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center">
          <div className="bg-gray-900 p-6 rounded-lg w-96 border border-gray-700">
            <h3 className="text-lg font-medium mb-4 text-white">
              File Options
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300">
                  Description (optional)
                </label>
                <textarea
                  onChange={(e) =>
                    setFileOptions((prev) => ({
                      ...prev,
                      [selectedFile.name]: {
                        ...prev[selectedFile.name],
                        description: e.target.value,
                      },
                    }))
                  }
                  className="mt-1 w-full p-2 border rounded bg-gray-800 text-white border-gray-700"
                  placeholder="Enter file description"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">
                  Custom URL (optional)
                </label>
                <input
                  type="text"
                  onChange={(e) =>
                    setFileOptions((prev) => ({
                      ...prev,
                      [selectedFile.name]: {
                        ...prev[selectedFile.name],
                        customUrl: e.target.value,
                      },
                    }))
                  }
                  className="mt-1 w-full p-2 border rounded bg-gray-800 text-white border-gray-700"
                  placeholder="Enter custom URL"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">
                  Password Protection (optional)
                </label>
                <input
                  type="password"
                  onChange={(e) =>
                    setFileOptions((prev) => ({
                      ...prev,
                      [selectedFile.name]: {
                        ...prev[selectedFile.name],
                        password: e.target.value,
                      },
                    }))
                  }
                  className="mt-1 w-full p-2 border rounded bg-gray-800 text-white border-gray-700"
                  placeholder="Enter password"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">
                  Expiration Date (optional)
                </label>
                <input
                  type="datetime-local"
                  onChange={(e) =>
                    setFileOptions((prev) => ({
                      ...prev,
                      [selectedFile.name]: {
                        ...prev[selectedFile.name],
                        expiresAt: e.target.value,
                      },
                    }))
                  }
                  className="mt-1 w-full p-2 border rounded bg-gray-800 text-white border-gray-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">
                  Max Downloads (optional)
                </label>
                <input
                  type="number"
                  min="1"
                  onChange={(e) =>
                    setFileOptions((prev) => ({
                      ...prev,
                      [selectedFile.name]: {
                        ...prev[selectedFile.name],
                        maxDownloads: parseInt(e.target.value) || null,
                      },
                    }))
                  }
                  className="mt-1 w-full p-2 border rounded bg-gray-800 text-white border-gray-700"
                  placeholder="Enter max downloads"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end space-x-2">
              <button
                onClick={() => {
                  setShowOptionsModal(false);
                  setSelectedFile(null);
                }}
                className="px-4 py-2 text-gray-400 hover:text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  handleOptionsSubmit(fileOptions[selectedFile.name] || {})
                }
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Upload
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUpload;
