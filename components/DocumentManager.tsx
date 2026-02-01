import React, { useState, useRef } from 'react';
import { useERP } from '../context/ERPContext';
import { useAuth } from '../context/AuthContext';
import { 
  File, FileText, Image as ImageIcon, Box, MoreVertical, 
  Upload, Search, Filter, Download, Trash2, Eye 
} from 'lucide-react';
import { ProjectDocument } from '../types';

export const DocumentManager: React.FC = () => {
  const { documents, addDocument, removeDocument, project } = useERP();
  const { user } = useAuth();
  const [filterType, setFilterType] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Mock upload process
      const typeMap: Record<string, any> = {
          'application/pdf': 'PDF',
          'image/jpeg': 'JPG',
          'image/png': 'JPG',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
          'image/vnd.dwg': 'DWG'
      };

      const docTypeMap: Record<string, any> = {
          'pdf': 'PLAN',
          'dwg': 'PLAN',
          'xlsx': 'OTHER'
      };

      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      const format = typeMap[file.type] || ext.toUpperCase();
      const type = docTypeMap[ext] || 'OTHER';

      const newDoc: ProjectDocument = {
          id: crypto.randomUUID(),
          organizationId: user?.organizationId || 'org_a',
          projectId: project.id,
          name: file.name,
          type: type,
          format: format as any,
          uploadDate: new Date().toISOString(),
          uploadedBy: user?.name || 'User',
          url: URL.createObjectURL(file)
      };

      addDocument(newDoc);
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const filteredDocs = documents.filter(d => {
      const matchesSearch = d.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === 'ALL' || d.type === filterType;
      return matchesSearch && matchesType;
  });

  const getIcon = (format: string) => {
      switch(format) {
          case 'PDF': return <FileText className="text-red-500" />;
          case 'XLSX': return <FileText className="text-green-600" />;
          case 'DWG': return <Box className="text-blue-600" />;
          case 'JPG': return <ImageIcon className="text-purple-500" />;
          default: return <File className="text-slate-400" />;
      }
  };

  return (
    <div className="space-y-6">
        {/* Header */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex justify-between items-center">
            <div>
                <h2 className="text-xl font-bold text-slate-800">Gestión Documental</h2>
                <p className="text-sm text-slate-500">Repositorio centralizado de planos, contratos y especificaciones.</p>
            </div>
            <div className="flex gap-2">
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    onChange={handleUpload} 
                />
                <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold shadow-lg flex items-center gap-2"
                >
                    <Upload size={18} /> Subir Documento
                </button>
            </div>
        </div>

        {/* Filters */}
        <div className="flex gap-4 items-center bg-slate-50 p-2 rounded-lg border border-slate-200">
            <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                <input 
                    type="text" 
                    placeholder="Buscar archivo..." 
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-md focus:outline-blue-500"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>
            <select 
                className="p-2 border border-slate-300 rounded-md bg-white text-sm font-medium"
                value={filterType}
                onChange={e => setFilterType(e.target.value)}
            >
                <option value="ALL">Todos los Tipos</option>
                <option value="PLAN">Planos (DWG/PDF)</option>
                <option value="CONTRACT">Contratos</option>
                <option value="INVOICE">Facturas</option>
                <option value="SPEC">Especificaciones</option>
            </select>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredDocs.map(doc => (
                <div key={doc.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow group relative">
                    <div className="flex justify-between items-start mb-3">
                        <div className="p-3 bg-slate-50 rounded-lg">
                            {getIcon(doc.format)}
                        </div>
                        <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded">{doc.format}</span>
                    </div>
                    
                    <h4 className="font-bold text-slate-800 text-sm mb-1 truncate" title={doc.name}>{doc.name}</h4>
                    <p className="text-xs text-slate-500 mb-4">Subido el {new Date(doc.uploadDate).toLocaleDateString()}</p>
                    
                    <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                        <div className="flex items-center gap-1 text-[10px] text-slate-400">
                            <div className="w-4 h-4 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                                {doc.uploadedBy.charAt(0)}
                            </div>
                            {doc.uploadedBy}
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button className="p-1.5 hover:bg-blue-50 text-blue-600 rounded" title="Ver"><Eye size={14} /></button>
                            <button className="p-1.5 hover:bg-slate-100 text-slate-600 rounded" title="Descargar"><Download size={14} /></button>
                            <button onClick={() => removeDocument(doc.id)} className="p-1.5 hover:bg-red-50 text-red-500 rounded" title="Eliminar"><Trash2 size={14} /></button>
                        </div>
                    </div>
                </div>
            ))}
            
            {filteredDocs.length === 0 && (
                <div className="col-span-full py-12 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                    <p>No se encontraron documentos.</p>
                </div>
            )}
        </div>
    </div>
  );
};