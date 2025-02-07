import React, { useState } from 'react';
import { Business } from '../../types/business';

interface Props {
  businesses: Business[];
  onExport: (format: 'csv' | 'json') => void;
  onSearch: (query: string) => void;
}

export const BusinessResults: React.FC<Props> = ({ businesses, onExport, onSearch }) => {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ status: '', percent: 0 });
  const [searchResults, setSearchResults] = useState<Business[]>([]);

  const handleSearchResponse = (data: any) => {
    console.log('Received search response:', data);
    
    if (data.type === 'error') {
      setError(data.error);
      setLoading(false);
      return;
    }

    if (data.type === 'progress') {
      setProgress({ status: data.status, percent: data.progress });
      return;
    }

    if (data.type === 'results') {
      console.log('Setting results:', data.results);
      setSearchResults(data.results);
      onSearch(data.results); // Pass results up to parent
      setLoading(false);
    }
  };

  const handleSearch = async (query: string) => {
    setLoading(true);
    setError(null);
    setProgress({ status: 'Starting search...', percent: 0 });

    try {
      const response = await fetch(
        `http://localhost:3000/api/search?q=${encodeURIComponent(query)}`,
        { 
          headers: { 
            Accept: 'application/json',
            'Cache-Control': 'no-cache'
          }
        }
      );

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          try {
            if (line.trim()) {
              const data = JSON.parse(line);
              handleSearchResponse(data);
            }
          } catch (e) {
            console.error('Error parsing JSON:', e, 'Line:', line);
          }
        }
      }
    } catch (error) {
      console.error('Search error:', error);
      setError('Failed to fetch results');
      setLoading(false);
    }
  };

  return (
    <div className="business-results">
      <div className="search-controls">
        <input 
          type="text" 
          placeholder="Search businesses..."
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              handleSearch(e.currentTarget.value);
            }
          }}
        />
        {loading && (
          <div className="progress">
            {progress.status} ({progress.percent}%)
          </div>
        )}
        {error && (
          <div className="error">
            {error}
          </div>
        )}
      </div>

      <div className="export-controls">
        <button onClick={() => onExport('csv')}>Export CSV</button>
        <button onClick={() => onExport('json')}>Export JSON</button>
      </div>
      
      <table className="business-table">
        <thead>
          <tr>
            <th>Business Name</th>
            <th>Contact</th>
            <th>Address</th>
            <th>Rating</th>
            <th>Website</th>
          </tr>
        </thead>
        <tbody>
          {(searchResults.length ? searchResults : businesses).map(business => (
            <tr key={business.id}>
              <td>{business.name}</td>
              <td>
                {business.phone}<br/>
                {business.email}
              </td>
              <td>{business.address}</td>
              <td>{business.rating}/5</td>
              <td>
                {business.website && (
                  <a href={business.website} target="_blank" rel="noopener noreferrer">
                    Visit Website
                  </a>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}; 