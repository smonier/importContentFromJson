import React from 'react';
import PropTypes from 'prop-types';
import {Button, Search} from '@jahia/moonstone';
import styles from './ImportContent.component.scss';

/**
 * Generic file uploader with optional preview button.
 */
const FileUploader = ({id, fileName, onChange, showPreview, onPreview, t}) => (
    <div className={styles.fileUpload}>
        <input
            type="file"
            id={id}
            className={styles.fileInput}
            onChange={e => onChange(e.target.files[0])}
        />
        <label htmlFor={id} className={styles.fileLabel}>
            {fileName || t('label.chooseFile')}
        </label>
        {showPreview && (
            <Button icon={<Search/>} aria-label={t('label.viewFile')} onClick={onPreview}/>
        )}
    </div>
);

FileUploader.propTypes = {
    id: PropTypes.string.isRequired,
    fileName: PropTypes.string,
    onChange: PropTypes.func.isRequired,
    showPreview: PropTypes.bool,
    onPreview: PropTypes.func,
    t: PropTypes.func.isRequired
};

export default FileUploader;
