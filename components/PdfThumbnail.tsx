import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// Use a specific version for the worker to match the library version if possible, 
// or fallback to a recent stable version.
// Note: In a real production app, you'd bundle the worker.
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

interface PdfThumbnailProps {
    url: string;
    width?: number;
    height?: number;
    className?: string;
}

export const PdfThumbnail: React.FC<PdfThumbnailProps> = ({ url, width = 200, height = 150, className }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        let isMounted = true;
        let renderTask: any = null;

        const renderThumbnail = async () => {
            if (!url) return;

            try {
                setLoading(true);
                setError(false);

                // Load the PDF document
                const loadingTask = pdfjsLib.getDocument(url);
                const pdf = await loadingTask.promise;

                if (!isMounted) return;

                // Get the first page
                const page = await pdf.getPage(1);

                if (!isMounted) return;

                const canvas = canvasRef.current;
                if (!canvas) return;

                const context = canvas.getContext('2d');
                if (!context) return;

                // Calculate scale to fit the requested dimensions
                // We render at a slightly higher scale for better quality on high-DPI screens
                const viewport = page.getViewport({ scale: 1.5 });
                
                canvas.width = viewport.width;
                canvas.height = viewport.height;

                // Render the page
                const renderContext = {
                    canvasContext: context,
                    viewport: viewport,
                };

                renderTask = page.render(renderContext as any);
                await renderTask.promise;

                if (isMounted) {
                    setLoading(false);
                }
            } catch (err) {
                console.error("Error rendering PDF thumbnail:", err);
                if (isMounted) {
                    setError(true);
                    setLoading(false);
                }
            }
        };

        renderThumbnail();

        return () => {
            isMounted = false;
            if (renderTask) {
                renderTask.cancel();
            }
        };
    }, [url]);

    if (error) {
        return (
            <div className={`flex items-center justify-center bg-slate-100 text-slate-400 text-xs ${className}`} style={{ width: '100%', height: '100%' }}>
                Preview Error
            </div>
        );
    }

    return (
        <div className={`relative overflow-hidden bg-slate-100 rounded-lg ${className}`} style={{ width: '100%', height: '100%' }}>
            {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-50 z-10">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-slate-300"></div>
                </div>
            )}
            <canvas ref={canvasRef} className="w-full h-full object-contain" />
        </div>
    );
};
