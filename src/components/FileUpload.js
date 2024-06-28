// src/components/FileUpload.js
import React, { useState } from "react";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { collection, addDoc } from "firebase/firestore";
import { storage, db } from "../firebase";

const FileUpload = ({ onUpload }) => {
  const [files, setFiles] = useState([]);
  const [description, setDescription] = useState("");
  const [password, setPassword] = useState("");
  const [expiry, setExpiry] = useState("");

  const handleFileChange = (e) => {
    setFiles([...e.target.files]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    for (const file of files) {
      const storageRef = ref(storage, `files/${file.name}`);
      const uploadTask = uploadBytesResumable(storageRef, file);
      console.log("this is 23");
      uploadTask.on(
        "state_changed",
        (snapshot) => {
          // Progress function if needed
        },
        (error) => {
          console.log(error);
        },
        async () => {
          console.log("this is 31");
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          const uploadedFile = {
            name: file.name,
            url: downloadURL,
            size: (file.size / 1024).toFixed(2) + " KB",
            uploadDate: new Date().toLocaleDateString(),
            description,
            password,
            expiry,
          };
          console.log("this is 44");

          // Add uploaded file metadata to Firestore
          try {
            const docRef = await addDoc(collection(db, "files"), uploadedFile);
            console.log("Document written with ID: ", docRef.id);
            // onUpload(uploadedFile);
            alert("Added Successfully");
          } catch (error) {
            console.error("Error adding document: ", error);
          }
        }
      );
    }

    setFiles([]);
    setDescription("");
    setPassword("");
    setExpiry("");
  };

  return (
    <div className="max-w-md mx-auto p-4 bg-white rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4">File Upload</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="file"
          multiple
          onChange={handleFileChange}
          className="block w-full mb-4"
        />
        <input
          type="text"
          placeholder="File Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="block w-full mb-4 p-2 border rounded"
        />
        <input
          type="password"
          placeholder="Password (4-12 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="block w-full mb-4 p-2 border rounded"
        />
        <input
          type="number"
          placeholder="Expire after (days)"
          value={expiry}
          onChange={(e) => setExpiry(e.target.value)}
          className="block w-full mb-4 p-2 border rounded"
        />
        <button
          type="submit"
          className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600"
        >
          Upload
        </button>
      </form>
    </div>
  );
};

export default FileUpload;
