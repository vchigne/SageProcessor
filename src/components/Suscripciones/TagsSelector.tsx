import React, { useState, useEffect, useRef } from 'react';
import { XMarkIcon } from '@heroicons/react/24/solid';

interface TagsSelectorProps {
  availableTags: string[];
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  placeholder?: string;
}

const TagsSelector: React.FC<TagsSelectorProps> = ({
  availableTags,
  selectedTags,
  onTagsChange,
  placeholder = 'Buscar...'
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [filteredTags, setFilteredTags] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filtrar tags según el término de búsqueda
  useEffect(() => {
    if (searchTerm) {
      const filtered = availableTags.filter(tag => 
        tag.toLowerCase().includes(searchTerm.toLowerCase()) && 
        !selectedTags.includes(tag)
      );
      setFilteredTags(filtered);
    } else {
      setFilteredTags([]);
    }
  }, [searchTerm, availableTags, selectedTags]);

  // Cerrar dropdown cuando se hace clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setShowDropdown(true);
  };

  const handleInputFocus = () => {
    setShowDropdown(true);
  };

  const handleTagSelect = (tag: string) => {
    const newTags = [...selectedTags, tag];
    onTagsChange(newTags);
    setSearchTerm('');
    // Mantener el foco en el input después de seleccionar
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleTagRemove = (tag: string) => {
    const newTags = selectedTags.filter(t => t !== tag);
    onTagsChange(newTags);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Si se presiona Backspace cuando el input está vacío, eliminar el último tag
    if (e.key === 'Backspace' && !searchTerm && selectedTags.length > 0) {
      const newTags = [...selectedTags];
      newTags.pop();
      onTagsChange(newTags);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="flex flex-wrap gap-2 p-2 border border-gray-300 rounded-md bg-white min-h-[42px]">
        {selectedTags.map(tag => (
          <span 
            key={tag} 
            className="flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-1 rounded-md text-sm"
          >
            {tag}
            <button 
              type="button"
              onClick={() => handleTagRemove(tag)}
              className="text-blue-500 hover:text-blue-700"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          className="flex-grow min-w-[150px] outline-none border-none focus:ring-0"
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          placeholder={selectedTags.length > 0 ? '' : placeholder}
        />
      </div>
      
      {showDropdown && filteredTags.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {filteredTags.map(tag => (
            <div 
              key={tag}
              className="px-4 py-2 cursor-pointer hover:bg-gray-100"
              onClick={() => handleTagSelect(tag)}
            >
              {tag}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TagsSelector;