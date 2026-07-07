import React from 'react';
import PropTypes from 'prop-types';
import {Typography, Banner, Field} from '@jahia/moonstone';
import styles from './ImportContent.component.scss';

/**
 * Display the list of JCR properties for the selected content type, inside a
 * Moonstone Field so its label lines up with the other fields in the panel.
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

    const renderProperty = property => (
        <div key={property.name} className={styles.propertyItem}>
            <Typography variant="body" className={styles.propertyText}>
                {property.displayName} - ({property.name} - {property.requiredType}{property.multiple ? '[]' : ''})
            </Typography>
        </div>
    );

    return (
        <Field id="propertiesField" label={t('label.properties')}>
            <div className={styles.propertiesInfo}>
                {mainProperties.length > 0 && (
                    <>
                        <Typography variant="caption" className={styles.sectionHeading}>
                            {t('label.mainProperties') || 'Main Properties'}
                        </Typography>
                        <div className={styles.propertiesList}>
                            {mainProperties.map(renderProperty)}
                        </div>
                    </>
                )}

                {Object.keys(groupedMixinProperties).length > 0 && (
                    <>
                        <Typography variant="caption" className={styles.sectionHeading}>
                            {t('label.mixinProperties') || 'Mixin Properties'}
                        </Typography>
                        {Object.entries(groupedMixinProperties).map(([mixinName, mixinData]) => (
                            <div key={mixinName} className={styles.mixinSection}>
                                <Typography variant="caption" className={styles.mixinName}>
                                    {mixinData.displayName} ({mixinName})
                                </Typography>
                                <div className={styles.propertiesList}>
                                    {mixinData.properties.map(renderProperty)}
                                </div>
                            </div>
                        ))}
                    </>
                )}

                {error && (
                    <Banner variant="danger" title={t('label.errorTitle')}>
                        <Typography variant="body">{t('label.loadPropertiesError')}</Typography>
                    </Banner>
                )}
            </div>
        </Field>
    );
};

PropertiesList.propTypes = {
    properties: PropTypes.array.isRequired,
    error: PropTypes.object,
    t: PropTypes.func.isRequired
};

export default PropertiesList;
