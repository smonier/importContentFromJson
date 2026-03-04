import React from 'react';
import PropTypes from 'prop-types';
import styles from './Tabs.scss';

/**
 * Custom Tabs component matching Moonstone design
 */
export const Tabs = ({value, onChange, children}) => {
    const tabs = React.Children.toArray(children);

    return (
        <div className={styles.tabsContainer}>
            <div className={styles.tabsList}>
                {tabs.map((tab, index) => (
                    <button
                        key={index}
                        className={`${styles.tab} ${value === index ? styles.tabActive : ''}`}
                        onClick={() => onChange(null, index)}
                    >
                        {tab.props.label}
                    </button>
                ))}
            </div>
        </div>
    );
};

Tabs.propTypes = {
    value: PropTypes.number.isRequired,
    onChange: PropTypes.func.isRequired,
    children: PropTypes.node.isRequired
};

export const Tab = ({label}) => null;

Tab.propTypes = {
    label: PropTypes.node.isRequired
};

export default Tabs;
