// Test page to debug rule loading issues

import React, { useState, useEffect } from 'react';
import { getPayers, getFacilities } from '../services/ruleService';

const TestRulePage: React.FC = () => {
  const [status, setStatus] = useState<string>('Loading...');
  const [payers, setPayers] = useState<any[]>([]);
  const [facilities, setFacilities] = useState<any[]>([]);
  const [errors, setErrors] = useState<any>({});

  useEffect(() => {
    testAPIs();
  }, []);

  const testAPIs = async () => {
    setStatus('Testing API endpoints...');

    // Test payers
    try {
      const payersData = await getPayers();
      setPayers(payersData);
      setStatus(prev => prev + '\n✅ Payers loaded successfully');
    } catch (error: any) {
      setErrors((prev: any) => ({ ...prev, payers: error }));
      setStatus(prev => prev + '\n❌ Payers failed: ' + (error.response?.data?.error || error.message));
    }

    // Test facilities
    try {
      const facilitiesData = await getFacilities();
      setFacilities(facilitiesData);
      setStatus(prev => prev + '\n✅ Facilities loaded successfully');
    } catch (error: any) {
      setErrors((prev: any) => ({ ...prev, facilities: error }));
      setStatus(prev => prev + '\n❌ Facilities failed: ' + (error.response?.data?.error || error.message));
    }

    setStatus(prev => prev + '\n\nTest complete!');
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Rule API Test Page</h1>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Status</h2>
          <pre className="bg-gray-100 p-4 rounded whitespace-pre-wrap font-mono text-sm">
            {status}
          </pre>
        </div>

        {Object.keys(errors).length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold text-red-800 mb-4">Errors</h2>
            {Object.entries(errors).map(([key, error]: [string, any]) => (
              <div key={key} className="mb-4">
                <h3 className="font-semibold text-red-700">{key}:</h3>
                <pre className="bg-white p-3 rounded mt-2 text-xs overflow-auto">
                  {JSON.stringify(error.response?.data || error.message, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        )}

        {payers.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Payers ({payers.length})</h2>
            <pre className="bg-gray-100 p-4 rounded whitespace-pre-wrap font-mono text-xs max-h-64 overflow-auto">
              {JSON.stringify(payers.slice(0, 3), null, 2)}
            </pre>
          </div>
        )}

        {facilities.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Facilities ({facilities.length})</h2>
            <pre className="bg-gray-100 p-4 rounded whitespace-pre-wrap font-mono text-xs max-h-64 overflow-auto">
              {JSON.stringify(facilities.slice(0, 3), null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default TestRulePage;
