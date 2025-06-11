import React from 'react';
import PropTypes from 'prop-types';
import {Dropdown, Typography} from '@jahia/moonstone';
import styles from './FieldMapping.scss';

export const FieldMapping = ({properties, fileFields, fieldMappings, setFieldMappings, t}) => {
    const dropdownData = fileFields.map(field => ({label: field, value: field}));

    const handleChange = (propertyName, value) => {
        setFieldMappings(prev => ({
            ...prev,
            [propertyName]: value
        }));
    };

    return (
        <div className={styles.container}>
            <Typography variant="heading" className={styles.heading}>{t('label.fieldMapping')}</Typography>
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
        </div>
    );
};

FieldMapping.propTypes = {
    properties: PropTypes.array.isRequired,
    fileFields: PropTypes.array.isRequired,
    fieldMappings: PropTypes.object.isRequired,
    setFieldMappings: PropTypes.func.isRequired,
    t: PropTypes.func.isRequired
};

export default FieldMapping;
