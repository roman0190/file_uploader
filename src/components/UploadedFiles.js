// src/components/UploadedFiles.js
import React, { useEffect, useState } from "react";
import { collection, getDocs, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

const UploadedFiles = () => {
  const [uploadedFiles, setUploadedFiles] = useState([]);

  useEffect(() => {
    // const fetchFiles = async () => {
    //   try {
    const connectionRef = collection(db, "files");
    const unsubscribe = onSnapshot(connectionRef, (querySnapshot) => {
      const filesList = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      console.log("Fetched Files:", filesList);
      setUploadedFiles(filesList);
    });

    //   } catch (error) {
    //     console.error('Error fetching files:', error);
    //   }
    // };
    // fetchFiles();
    return () => unsubscribe();
  }, []); // Empty dependency array to fetch once on component mount

  return (
    <div className="max-w-4xl mx-auto p-4 bg-white rounded-lg shadow-md mt-6">
      <h2 className="text-xl font-bold mb-4">Uploaded Files</h2>
      <table className="min-w-full bg-white">
        <thead>
          <tr>
            <th className="py-2 px-4 border-b">File Name</th>
            <th className="py-2 px-4 border-b">File Size</th>
            <th className="py-2 px-4 border-b">Upload Date</th>
            <th className="py-2 px-4 border-b">Description</th>
            <th className="py-2 px-4 border-b">Action</th>
          </tr>
        </thead>
        <tbody>
          {uploadedFiles.map((file, index) => (
            <tr key={index}>
              <td className="py-2 px-4 border-b">{file.name}</td>
              <td className="py-2 px-4 border-b">{file.size}</td>
              <td className="py-2 px-4 border-b">{file.uploadDate}</td>
              <td className="py-2 px-4 border-b">
                {file.description || "N/A"}
              </td>
              <td className="py-2 px-4 border-b">
                <a
                  href={file.url}
                  className="bg-green-500 text-white p-2 rounded hover:bg-green-600"
                  download
                >
                  Download
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default UploadedFiles;
