import React, { useState, useEffect, useRef } from 'react';
import { X, ZoomIn, ZoomOut, Download, Move } from 'lucide-react';
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import * as XLSX from 'xlsx';
import { renderAsync } from 'docx-preview';

interface FilePreviewModalProps {
    file: {
        name: string;
        url: string;
        type: string; // MIME type or extension
    };
    onClose: () => void;
}

export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({ file, onClose }) => {
    const [content, setContent] = useState<React.ReactNode>(null);
    const [loading, setLoading] = useState(true);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const loadContent = async () => {
            setLoading(true);
            try {
                const ext = file.name.split('.').pop()?.toLowerCase();
                
                // 1. Images
                if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) {
                    setContent(
                        <TransformWrapper>
                            <TransformComponent>
                                <img src={file.url} alt={file.name} className="max-h-[80vh] max-w-full object-contain" />
                            </TransformComponent>
                        </TransformWrapper>
                    );
                }
                // 2. PDF
                else if (ext === 'pdf') {
                    setContent(
                        <iframe src={file.url} className="w-full h-[80vh] border-none" title="PDF Preview" />
                    );
                }
                // 3. Excel (XLSX)
                else if (['xlsx', 'xls', 'csv'].includes(ext || '')) {
                    const response = await fetch(file.url);
                    const blob = await response.blob();
                    const arrayBuffer = await blob.arrayBuffer();
                    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                    
                    setContent(
                        <div className="overflow-auto max-h-[80vh] bg-white w-full">
                            <table className="min-w-full border-collapse border border-slate-200 text-sm">
                                <thead>
                                    <tr>
                                        {/* Row Number Header */}
                                        <th className="bg-slate-100 border border-slate-300 w-10 text-center text-slate-500 font-mono text-xs p-1 sticky top-0 left-0 z-20">
                                            #
                                        </th>
                                        {/* Column Headers (A, B, C...) */}
                                        {(jsonData[0] as any[] || []).map((_, colIndex) => (
                                            <th key={colIndex} className="bg-slate-100 border border-slate-300 px-4 py-1 text-left font-semibold text-slate-700 sticky top-0 z-10 min-w-[100px]">
                                                {XLSX.utils.encode_col(colIndex)}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {(jsonData as any[][]).map((row, rowIndex) => (
                                        <tr key={rowIndex} className="hover:bg-blue-50 transition-colors">
                                            {/* Row Number */}
                                            <td className="bg-slate-50 border border-slate-300 text-center text-slate-500 font-mono text-xs p-1 sticky left-0 z-10">
                                                {rowIndex + 1}
                                            </td>
                                            {/* Data Cells */}
                                            {row.map((cell, cellIndex) => (
                                                <td key={cellIndex} className="border border-slate-200 px-4 py-1.5 text-slate-800 whitespace-nowrap">
                                                    {cell !== null && cell !== undefined ? String(cell) : ''}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    );
                }
                // 4. Word (DOCX)
                else if (['docx'].includes(ext || '')) {
                    const response = await fetch(file.url);
                    const blob = await response.blob();
                    if (containerRef.current) {
                        await renderAsync(blob, containerRef.current, containerRef.current, {
                            className: "docx-preview",
                            inWrapper: true,
                            ignoreWidth: false,
                            ignoreHeight: false,
                            ignoreFonts: false,
                            breakPages: true,
                            ignoreLastRenderedPageBreak: true,
                            experimental: false,
                            trimXmlDeclaration: true,
                            useBase64URL: false,
                            debug: false,
                        });
                        // Content is rendered directly into the ref, so we set a placeholder
                        setContent(<div />); 
                    }
                }
                // 5. DWG / DWF (Placeholder)
                else if (['dwg', 'dwf'].includes(ext || '')) {
                    setContent(
                        <div className="flex flex-col items-center justify-center h-[60vh] text-slate-500">
                            <div className="bg-slate-100 p-8 rounded-full mb-4">
                                <Move size={48} className="text-slate-400" />
                            </div>
                            <h3 className="text-lg font-bold mb-2">Vista previa de CAD</h3>
                            <p className="text-sm mb-6 max-w-md text-center">
                                Los archivos DWG son formatos propietarios. Para visualizarlos sin AutoCAD, 
                                puede utilizar el visor gratuito de Autodesk.
                            </p>
                            <div className="flex gap-4">
                                <a 
                                    href={file.url} 
                                    download={file.name}
                                    className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
                                >
                                    <Download size={18} /> Descargar Archivo
                                </a>
                                <a 
                                    href="https://viewer.autodesk.com/" 
                                    target="_blank"
                                    rel="noreferrer"
                                    className="bg-white border border-slate-300 text-slate-700 px-6 py-2 rounded-lg hover:bg-slate-50 flex items-center gap-2"
                                >
                                    <Move size={18} /> Ir a Autodesk Viewer
                                </a>
                            </div>
                        </div>
                    );
                }
                // Default
                else {
                    setContent(
                        <div className="flex flex-col items-center justify-center h-[60vh] text-slate-500">
                            <p>Vista previa no disponible para este formato.</p>
                            <a 
                                href={file.url} 
                                download={file.name}
                                className="mt-4 text-blue-600 hover:underline flex items-center gap-2"
                            >
                                <Download size={16} /> Descargar
                            </a>
                        </div>
                    );
                }
            } catch (error) {
                console.error("Preview error:", error);
                setContent(<div className="p-8 text-red-500">Error al cargar la vista previa.</div>);
            } finally {
                setLoading(false);
            }
        };

        loadContent();
    }, [file]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-slate-200 bg-slate-50">
                    <h3 className="font-bold text-slate-800 truncate flex-1 pr-4">{file.name}</h3>
                    <div className="flex items-center gap-2">
                        <a 
                            href={file.url} 
                            download={file.name}
                            className="p-2 hover:bg-slate-200 rounded-full text-slate-600 transition-colors"
                            title="Descargar"
                        >
                            <Download size={20} />
                        </a>
                        <button 
                            onClick={onClose}
                            className="p-2 hover:bg-red-100 hover:text-red-600 rounded-full text-slate-500 transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto bg-slate-100 p-4 flex items-center justify-center relative min-h-[400px]">
                    {loading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/50 z-10">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                        </div>
                    )}
                    
                    {/* Container for DOCX rendering */}
                    <div ref={containerRef} className={`${file.name.endsWith('.docx') ? 'bg-white p-8 shadow-lg min-h-full w-full max-w-4xl' : ''}`}>
                        {content}
                    </div>
                </div>
            </div>
        </div>
    );
};
