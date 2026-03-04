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
            if (value) {
                updated[propertyName] = value;
            } else {
                updated[propertyName] = null;
            }

            return updated;
        });
    };

    // Separate main properties from mixin properties
    const mainProperties = properties.filter(prop => !prop.mixinName);
    const mixinProperties = properties.filter(prop => prop.mixinName);
    
    // Group mixin properties by mixin
    const groupedMixinProperties = mixinProperties.reduce((acc, prop) => {
        if (!acc[prop.mixinName]) {
            acc[prop.mixinName] = {
                displayName: prop.mixinDisplayName,
                properties: []
            };
        }
        acc[prop.mixinName].properties.push(prop);
        return acc;
    }, {});

    return (
        <div className={styles.container}>
            <Typography variant="subheading" className={styles.heading}>{t('label.fieldMapping')}</Typography>
            <div className={styles.headerRow}>
                <Typography variant="caption" className={styles.headerLeft}>{t('label.contentTypeProperties')}</Typography>
                <Typography variant="caption" className={styles.headerRight}>{t('label.uploadedFileFields')}</Typography>
            </div>
            
            {/* Main Properties */}
            {mainProperties.length > 0 && (
                <div className={styles.section}>
                    <div className={styles.sectionHeader}>
                        <Typography variant="caption" className={styles.sectionLabel}>
                            {t('label.mainProperties') || 'Main Properties'}
                        </Typography>
                    </div>
                    {mainProperties.map(prop => (
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
            )}
            
            {/* Mixin Properties */}
            {Object.entries(groupedMixinProperties).map(([mixinName, mixinData]) => (
                <div key={mixinName} className={styles.section}>
                    <div className={styles.sectionHeader}>
                        <Typography variant="caption" className={styles.sectionLabel}>
                            {mixinData.displayName} ({mixinName})
                        </Typography>
                    </div>
                    {mixinData.properties.map(prop => (
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
            ))}
            
            {/* Extra Fields */}
            {extraFields.length > 0 && (
                <div className={styles.section}>
                    <div className={styles.sectionHeader}>
                        <Typography variant="caption" className={styles.sectionLabel}>
                            {t('label.extraFields') || 'Extra Fields'}
                        </Typography>
                    </div>
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
            )}
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
