'use client';
import { useEffect, useState } from 'react';

interface PDFViewerProps {
  fileId: string;
  page?: number;
  searchText?: string;
}

export default function PDFViewer({ fileId, page = 1, searchText }: PDFViewerProps) {
  const pdfUrl = `/api/uploads/${fileId}/content${page ? `?page=${page}` : ''}`;
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setError(null);
    console.log('PDFViewer - Tentative de chargement du PDF:', {
      fileId,
      page,
      url: pdfUrl
    });

    // Vérifier si l'URL est accessible
    fetch(pdfUrl)
      .then(response => {
        console.log('PDFViewer - Réponse du serveur:', {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries())
        });
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        setLoading(false);
      })
      .catch(error => {
        console.error('PDFViewer - Erreur lors du chargement du PDF:', error);
        setError(error.message);
        setLoading(false);
      });
  }, [pdfUrl, fileId]);

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-red-50 text-red-500">
        <p>Erreur de chargement du PDF: {error}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-50">
        <p>Chargement du PDF...</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-white">
      <iframe 
        src={pdfUrl}
        className="w-full h-full border-0"
        title="PDF Viewer"
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
        loading="eager"
        referrerPolicy="no-referrer"
        allow="fullscreen"
        onLoad={() => console.log('PDFViewer - iframe chargée')}
        onError={(e) => {
          console.error('PDFViewer - Erreur iframe:', e);
          setError('Erreur lors de l\'affichage du PDF');
        }}
      />
    </div>
  );
}