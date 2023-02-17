import React, { useState } from 'react';
import PropTypes from 'prop-types';
import SearchForm from './SearchForm';
import SearchResults from './SearchResults';
import catalogService from '../../services/catalogService';
import theme from '../../config/colorPalette';
import useNotification from '../../hooks/useNotification';
import Notification from '../Notification';

const containerStyle = {
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center'
};

const titleStyle = {
  color: theme.light,
  fontSize: '22px',
  alignSelf: 'center',
}

const SearchContainer = ({ onSearchResultClick }) => {
  const [results, setResults] = useState([]);
  const notification = useNotification();

  const handleBookSearchSubmit = (event) => {
    event.preventDefault();
    const query = event.target[0].value;
    if (query.trim()) {
      console.log('Searching catalog for ', query);
      catalogService.searchCatalog(query).then((results) => {
        setResults(results);
        if (results.length === 0) {
          notification.update(`No results found for ${query}`)
        }
      });
    } else {
      setResults([]);
    }
  };

  return (
    <div style={containerStyle}>
      <span style={titleStyle}>Find Authors on Project Gutenberg</span>
      <SearchForm onSubmit={handleBookSearchSubmit} />
      {notification.text && <Notification text={notification.text} />}
      <SearchResults results={results} onResultClick={onSearchResultClick} />
    </div>
  );
};

SearchContainer.propTypes = {
  onSearchResultClick: PropTypes.func.isRequired,
};

export default SearchContainer;
