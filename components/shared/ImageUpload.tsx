import React, { useState, useRef, useEffect } from 'react';
import Modal from './Modal';
import { PencilIcon } from './Icons';

const CameraModal: React.FC<{ isOpen: boolean; onClose: () => void; onCapture: (dataUrl: string) => void; }> = ({ isOpen, onClose, onCapture }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const startCamera = async () => {
            if (isOpen) {
                try {
                    setError(null);
                    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                    streamRef.current = stream;
                    if (videoRef.current) {
                        videoRef.current.srcObject = stream;
                    }
                } catch (err) {
                    console.error("Error accessing camera:", err);
                    setError("Could not access camera. Please check permissions.");
                }
            }
        };

        startCamera();

        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
        };
    }, [isOpen]);

    const handleCapture = () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (video && canvas) {
            const context = canvas.getContext('2d');
            if (context) {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
                const dataUrl = canvas.toDataURL('image/jpeg');
                onCapture(dataUrl);
            }
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Take Photo">
            <div className="space-y-4">
                {error ? (
                    <div className="bg-red-100 text-red-700 p-3 rounded-md">{error}</div>
                ) : (
                    <div className="bg-black rounded-md overflow-hidden">
                        <video ref={videoRef} autoPlay playsInline className="w-full h-auto" />
                        <canvas ref={canvasRef} className="hidden" />
                    </div>
                )}
                <div className="flex justify-end gap-3">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-200 bg-gray-100 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-md hover:bg-gray-200 dark:hover:bg-slate-600">Cancel</button>
                    <button type="button" onClick={handleCapture} disabled={!!error} className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary-dark disabled:opacity-50">Capture</button>
                </div>
            </div>
        </Modal>
    );
};

const UploadOptionsModal: React.FC<{ isOpen: boolean; onClose: () => void; onTakePhoto: () => void; onChooseFile: () => void; }> = ({ isOpen, onClose, onTakePhoto, onChooseFile }) => (
    <Modal isOpen={isOpen} onClose={onClose} title="Update Profile Picture">
        <div className="flex flex-col space-y-3">
            <button type="button" onClick={onTakePhoto} className="w-full text-left px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">Take Photo with Camera</button>
            <button type="button" onClick={onChooseFile} className="w-full text-left px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">Choose from Library</button>
        </div>
    </Modal>
);

export const AvatarUploader: React.FC<{ onAvatarSelected: (base64: string) => void; avatarPreview: string | null; }> = ({ onAvatarSelected, avatarPreview }) => {
    const [isUploadOptionsOpen, setUploadOptionsOpen] = useState(false);
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleChooseFile = () => {
        setUploadOptionsOpen(false);
        fileInputRef.current?.click();
    };

    const handleTakePhoto = () => {
        setUploadOptionsOpen(false);
        setIsCameraOpen(true);
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = reader.result as string;
            onAvatarSelected(base64String);
        };
        reader.readAsDataURL(file);
    };

    const handleCapture = (dataUrl: string) => {
        setIsCameraOpen(false);
        onAvatarSelected(dataUrl);
    };

    return (
        <div className="flex flex-col items-center">
            <div className="relative group">
                <button type="button" onClick={() => setUploadOptionsOpen(true)} className="w-28 h-28 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-surface dark:focus:ring-offset-slate-800 focus:ring-primary bg-gray-100 dark:bg-slate-700 flex items-center justify-center">
                    {avatarPreview ? (
                        <img src={avatarPreview} alt="Profile Preview" className="w-28 h-28 rounded-full object-cover"/>
                    ) : (
                        <div className="w-28 h-28 rounded-full bg-gray-200 dark:bg-slate-600 flex items-center justify-center text-gray-400">
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                        </div>
                    )}
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 rounded-full flex items-center justify-center transition-opacity duration-300">
                       <PencilIcon className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    </div>
                </button>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/png, image/jpeg" />
            </div>

            <UploadOptionsModal
                isOpen={isUploadOptionsOpen}
                onClose={() => setUploadOptionsOpen(false)}
                onTakePhoto={handleTakePhoto}
                onChooseFile={handleChooseFile}
            />

            <CameraModal
                isOpen={isCameraOpen}
                onClose={() => setIsCameraOpen(false)}
                onCapture={handleCapture}
            />
        </div>
    );
};
