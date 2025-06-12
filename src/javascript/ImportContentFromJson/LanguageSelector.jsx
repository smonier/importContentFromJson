import React from 'react';
import PropTypes from 'prop-types';
import {Dropdown, Typography} from '@jahia/moonstone';
import styles from './ImportContent.component.scss';

/**
 * Dropdown for selecting the language used for the import.
 */
const LanguageSelector = ({languages, selectedLanguage, onChange, error, t}) => (
    <>
        <Typography variant="heading" className={styles.heading}>
            {t('label.selectLanguage')}
        </Typography>
        <Dropdown
            data={languages}
            value={selectedLanguage}
            className={styles.customDropdown}
            placeholder={t('label.selectPlaceholder')}
            onChange={(e, item) => { onChange(item.value); console.log('Selected language:', item.value); }}
        />
        {error && (
            <Typography variant="body" className={styles.errorMessage}>
                {t('label.loadContentTypesError')}
            </Typography>
        )}
    </>
);

LanguageSelector.propTypes = {
    languages: PropTypes.array.isRequired,
    selectedLanguage: PropTypes.string.isRequired,
    onChange: PropTypes.func.isRequired,
    error: PropTypes.object,
    t: PropTypes.func.isRequired
};

export default LanguageSelector;
