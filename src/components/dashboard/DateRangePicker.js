import React, { useState } from 'react';

export default function DateRangePicker({ onChange, defaultDays = 7 }) {
  const today = new Date();
  const formatDate = (date) => {
    return date.toISOString().split('T')[0];
  };
  
  const getDateBefore = (days) => {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return formatDate(date);
  };
  
  const [startDate, setStartDate] = useState(getDateBefore(defaultDays));
  const [endDate, setEndDate] = useState(formatDate(today));
  const [selectedRange, setSelectedRange] = useState(`${defaultDays}`);

  const handleRangeChange = (e) => {
    const days = parseInt(e.target.value);
    setSelectedRange(e.target.value);
    
    // Para opción personalizada, no cambiar fechas
    if (days === 0) return;
    
    const newStartDate = getDateBefore(days);
    setStartDate(newStartDate);
    setEndDate(formatDate(today));
    
    if (onChange) {
      onChange({
        startDate: newStartDate,
        endDate: formatDate(today),
        days
      });
    }
  };

  const handleStartDateChange = (e) => {
    setStartDate(e.target.value);
    setSelectedRange('0'); // Personalizado
  };

  const handleEndDateChange = (e) => {
    setEndDate(e.target.value);
    setSelectedRange('0'); // Personalizado
  };

  return (
    <div className="flex flex-col md:flex-row gap-2 items-end mb-4 bg-white p-3 rounded-lg shadow">
      <div className="flex flex-col">
        <label className="text-sm text-gray-600 mb-1">Rango predefinido</label>
        <select 
          value={selectedRange}
          onChange={handleRangeChange}
          className="border rounded-md px-3 py-2 text-sm"
        >
          <option value="7">Última semana</option>
          <option value="30">Último mes</option>
          <option value="90">Últimos 3 meses</option>
          <option value="180">Últimos 6 meses</option>
          <option value="365">Último año</option>
          <option value="0">Personalizado</option>
        </select>
      </div>
      
      <div className="flex flex-col">
        <label className="text-sm text-gray-600 mb-1">Fecha inicio</label>
        <input 
          type="date" 
          value={startDate}
          onChange={handleStartDateChange}
          className="border rounded-md px-3 py-2 text-sm"
        />
      </div>
      
      <div className="flex flex-col">
        <label className="text-sm text-gray-600 mb-1">Fecha fin</label>
        <input 
          type="date" 
          value={endDate}
          onChange={handleEndDateChange}
          className="border rounded-md px-3 py-2 text-sm"
        />
      </div>
      
      <button 
        onClick={() => onChange({ startDate, endDate, days: parseInt(selectedRange) })}
        className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm hover:bg-indigo-700"
      >
        Aplicar filtro
      </button>
    </div>
  );
}