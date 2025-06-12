import React from 'react';
import PropTypes from 'prop-types';
import {Typography} from '@jahia/moonstone';
import styles from './ImportContent.component.scss';

/**
 * Display the list of JCR properties for the selected content type.
 */
const PropertiesList = ({properties, error, t}) => (
    <div className={styles.propertiesInfo}>
        <Typography variant="heading" className={styles.heading}>
            {t('label.properties')}
        </Typography>
        <div className={styles.propertiesList}>
            {properties.map(property => (
                <div key={property.name} className={styles.propertyItem}>
                    <Typography variant="body" className={styles.propertyText}>
                        {property.displayName} - ({property.name} - {property.requiredType}{property.multiple ? '[]' : ''})
                    </Typography>
                </div>
            ))}
        </div>
        {error && (
            <Typography variant="body" className={styles.errorMessage}>
                {t('label.loadPropertiesError')}
            </Typography>
        )}
    </div>
);

PropertiesList.propTypes = {
    properties: PropTypes.array.isRequired,
    error: PropTypes.object,
    t: PropTypes.func.isRequired
};

export default PropertiesList;
