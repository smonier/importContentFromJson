import React from 'react';
import PropTypes from 'prop-types';
import {Button} from '@jahia/moonstone';
import Modal from '~/DesignSystem/Modal';
import styles from './ImportContent.component.scss';

/**
 * Dialog showing the preview of mapped JSON data before import.
 */
const ImportPreviewDialog = ({open, onClose, previewData, onDownload, onStart, t}) => (
    <Modal
        open={open}
        onClose={onClose}
        title={t('label.previewTitle')}
        maxWidth="md"
        fullWidth
        actions={[
            <Button key="download" label={t('label.downloadJson')} onClick={onDownload}/>,
            <Button key="start" color="accent" label={t('label.startImport')} onClick={onStart}/>
        ]}
    >
        <pre className={styles.previewContent}>{JSON.stringify(previewData, null, 2)}</pre>
    </Modal>
);

ImportPreviewDialog.propTypes = {
    open: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    previewData: PropTypes.any,
    onDownload: PropTypes.func.isRequired,
    onStart: PropTypes.func.isRequired,
    t: PropTypes.func.isRequired
};

export default ImportPreviewDialog;
