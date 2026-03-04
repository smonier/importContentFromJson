import React from 'react';
import PropTypes from 'prop-types';
import {Typography} from '@jahia/moonstone';
import styles from './ImportContent.component.scss';

/**
 * Display the list of JCR properties for the selected content type.
 */
const PropertiesList = ({properties, error, t}) => {
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
        <div className={styles.propertiesInfo}>
            <Typography variant="subheading" className={styles.heading}>
                {t('label.properties')}
            </Typography>
            
            {/* Main Properties */}
            {mainProperties.length > 0 && (
                <>
                    <Typography variant="caption" className={styles.sectionHeading}>
                        {t('label.mainProperties') || 'Main Properties'}
                    </Typography>
                    <div className={styles.propertiesList}>
                        {mainProperties.map(property => (
                            <div key={property.name} className={styles.propertyItem}>
                                <Typography variant="body" className={styles.propertyText}>
                                    {property.displayName} - ({property.name} - {property.requiredType}{property.multiple ? '[]' : ''})
                                </Typography>
                            </div>
                        ))}
                    </div>
                </>
            )}
            
            {/* Mixin Properties */}
            {Object.keys(groupedMixinProperties).length > 0 && (
                <>
                    <Typography variant="caption" className={styles.sectionHeading} style={{marginTop: '16px'}}>
                        {t('label.mixinProperties') || 'Mixin Properties'}
                    </Typography>
                    {Object.entries(groupedMixinProperties).map(([mixinName, mixinData]) => (
                        <div key={mixinName} className={styles.mixinSection}>
                            <Typography variant="caption" className={styles.mixinName}>
                                {mixinData.displayName} ({mixinName})
                            </Typography>
                            <div className={styles.propertiesList}>
                                {mixinData.properties.map(property => (
                                    <div key={property.name} className={styles.propertyItem}>
                                        <Typography variant="body" className={styles.propertyText}>
                                            {property.displayName} - ({property.name} - {property.requiredType}{property.multiple ? '[]' : ''})
                                        </Typography>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </>
            )}
            
            {error && (
                <Typography variant="body" className={styles.errorMessage}>
                    {t('label.loadPropertiesError')}
                </Typography>
            )}
        </div>
    );
};

PropertiesList.propTypes = {
    properties: PropTypes.array.isRequired,
    error: PropTypes.object,
    t: PropTypes.func.isRequired
};

export default PropertiesList;
