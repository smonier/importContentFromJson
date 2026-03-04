import React from 'react';
import PropTypes from 'prop-types';
import styles from './Modal.scss';

/**
 * Custom Modal component using Moonstone design system
 */
export const Modal = ({open, onClose, title, children, actions, maxWidth = 'md', fullWidth = true}) => {
    if (!open) {
        return null;
    }

    const widthClass = maxWidth === 'md' ? styles.modalMd : styles.modalLg;

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div
                className={`${styles.modal} ${widthClass} ${fullWidth ? styles.fullWidth : ''}`}
                onClick={e => e.stopPropagation()}
            >
                {title && (
                    <div className={styles.header}>
                        <h2 className={styles.title}>{title}</h2>
                        <button type="button" className={styles.closeButton} onClick={onClose}>&times;</button>
                    </div>
                )}
                <div className={styles.content}>
                    {children}
                </div>
                {actions && actions.length > 0 && (
                    <div className={styles.footer}>
                        {actions}
                    </div>
                )}
            </div>
        </div>
    );
};

Modal.propTypes = {
    open: PropTypes.bool.isRequired, // eslint-disable-line react/boolean-prop-naming
    onClose: PropTypes.func.isRequired,
    title: PropTypes.string,
    children: PropTypes.node,
    actions: PropTypes.arrayOf(PropTypes.node),
    maxWidth: PropTypes.oneOf(['md', 'lg']),
    fullWidth: PropTypes.bool // eslint-disable-line react/boolean-prop-naming
};

export default Modal;
