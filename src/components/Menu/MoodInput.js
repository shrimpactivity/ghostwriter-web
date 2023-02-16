import React from 'react';
import PropTypes from 'prop-types';
import theme from '../../config/colorPalette';

const selectStyle = {
  width: '150px',
  height: '30px',
  color: 'black',
  backgroundColor: theme.light,
  borderColor: theme.darkest,
  borderRadius: '5px',
  font: '18px Roboto',
  textOverflow: 'ellipsis',
  overflow: 'hidden',
  float: 'right'
};

const optionStyle = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  fontSize: '14px',
};

const containerStyle = {
  padding: '5px',
};

const labelStyle = {
  fontSize: '18px',
  marginRight: '10px',
};

const MoodInput = ({ value, onChange, label }) => {
  return (
    <div style={containerStyle}>
      <span style={labelStyle}>{label}</span>
      <select style={selectStyle} value={value} onChange={onChange}>
        <option style={optionStyle} value="3">
          Articulate
        </option>
        <option style={optionStyle} value="2">
          Intelligible
        </option>
        <option style={optionStyle} value="1">
          Experimental
        </option>
        <option style={optionStyle} value="0">
          Inebriated
        </option>
      </select>
    </div>
  );
};

MoodInput.propTypes = {
  value: PropTypes.number.isRequired,
  onChange: PropTypes.func.isRequired,
  label: PropTypes.string.isRequired,
};

export default MoodInput;