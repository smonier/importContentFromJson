import React from 'react';
import PropTypes from 'prop-types';
import styles from './Checkbox.scss';

/**
 * Custom Checkbox component matching Moonstone design
 */
export const Checkbox = ({checked, onChange, label, id}) => {
    const inputId = id || `checkbox-${Math.random().toString(36).substr(2, 9)}`;

    return (
        <div className={styles.checkboxContainer}>
            <input
                type="checkbox"
                id={inputId}
                checked={checked}
                onChange={onChange}
                className={styles.checkbox}
            />
            <label htmlFor={inputId} className={styles.label}>
                {label}
            </label>
        </div>
    );
};

Checkbox.propTypes = {
    checked: PropTypes.bool.isRequired,
    onChange: PropTypes.func.isRequired,
    label: PropTypes.string.isRequired,
    id: PropTypes.string
};

export default Checkbox;
