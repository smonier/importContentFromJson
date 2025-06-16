import React from 'react';
import PropTypes from 'prop-types';
import {Dropdown, Typography} from '@jahia/moonstone';
import styles from './FieldMapping.scss';

export const FieldMapping = ({properties, extraFields = [], fileFields, fieldMappings, setFieldMappings, t}) => {
    const dropdownData = [{label: t('label.none'), value: ''},
        ...fileFields.map(field => ({label: field, value: field}))];

    const handleChange = (propertyName, value) => {
        console.log('Field mapping changed', propertyName, '->', value);
        setFieldMappings(prev => {
            const updated = {...prev};
            if (!value) {
                delete updated[propertyName];
            } else {
                updated[propertyName] = value;
            }

            return updated;
        });
    };

    return (
        <div className={styles.container}>
            <Typography variant="heading" className={styles.heading}>{t('label.fieldMapping')}</Typography>
            <div className={styles.headerRow}>
                <Typography variant="subheading" className={styles.headerLeft}>{t('label.contentTypeProperties')}</Typography>
                <Typography variant="subheading" className={styles.headerRight}>{t('label.uploadedFileFields')}</Typography>
            </div>
            {properties.map(prop => (
                <div key={prop.name} className={styles.mappingRow}>
                    <Typography variant="body" className={styles.propertyName}>{prop.name}</Typography>
                    <Dropdown
                        data={dropdownData}
                        value={fieldMappings[prop.name] || ''}
                        placeholder={t('label.selectPlaceholder')}
                        className={styles.dropdown}
                        onChange={(e, item) => handleChange(prop.name, item.value)}
                    />
                </div>
            ))}
            {extraFields.map(field => (
                <div key={field.name} className={styles.mappingRow}>
                    <Typography variant="body" className={styles.propertyName}>{field.displayName || field.name}</Typography>
                    <Dropdown
                        data={dropdownData}
                        value={fieldMappings[field.name] || ''}
                        placeholder={t('label.selectPlaceholder')}
                        className={styles.dropdown}
                        onChange={(e, item) => handleChange(field.name, item.value)}
                    />
                </div>
            ))}
        </div>
    );
};

FieldMapping.propTypes = {
    properties: PropTypes.array.isRequired,
    extraFields: PropTypes.arrayOf(
        PropTypes.shape({
            name: PropTypes.string.isRequired,
            displayName: PropTypes.string
        })
    ),
    fileFields: PropTypes.array.isRequired,
    fieldMappings: PropTypes.object.isRequired,
    setFieldMappings: PropTypes.func.isRequired,
    t: PropTypes.func.isRequired
};

export default FieldMapping;
