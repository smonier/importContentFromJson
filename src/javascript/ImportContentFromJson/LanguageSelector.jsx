import React from 'react';
import PropTypes from 'prop-types';
import {Dropdown, Field} from '@jahia/moonstone';

/**
 * Moonstone Field wrapping the language selection dropdown.
 */
const LanguageSelector = ({languages, selectedLanguage, onChange, error, t}) => (
    <Field
        id="importLanguageField"
        label={t('label.selectLanguage')}
        hasError={Boolean(error)}
        errorMessage={error ? t('label.loadContentTypesError') : undefined}
    >
        <Dropdown
            data={languages}
            value={selectedLanguage}
            placeholder={t('label.selectPlaceholder')}
            onChange={(e, item) => onChange(item.value)}
        />
    </Field>
);

LanguageSelector.propTypes = {
    languages: PropTypes.array.isRequired,
    selectedLanguage: PropTypes.string.isRequired,
    onChange: PropTypes.func.isRequired,
    error: PropTypes.object,
    t: PropTypes.func.isRequired
};

export default LanguageSelector;
