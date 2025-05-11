"use client";
import FileUpload from "@/components/FileUpload";
import FileList from "@/components/FileList";
import { Toaster } from "react-hot-toast";

export default function Home() {
  return (
    <div className="min-h-screen p-8 bg-gray-950">
      <Toaster position="top-right" />
      <div className="max-w-4xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold text-center text-white">
          File Uploader
        </h1>
        <FileUpload />
        <FileList />
      </div>
    </div>
  );
}
