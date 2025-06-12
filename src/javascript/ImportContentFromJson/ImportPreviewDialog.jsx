import React from 'react';
import PropTypes from 'prop-types';
import {Button} from '@jahia/moonstone';
import {Dialog, DialogTitle, DialogContent, DialogActions} from '@mui/material';
import styles from './ImportContent.component.scss';

/**
 * Dialog showing the preview of mapped JSON data before import.
 */
const ImportPreviewDialog = ({open, onClose, previewData, onDownload, onStart, t}) => (
    <Dialog fullWidth open={open} maxWidth="md" onClose={onClose}>
        <DialogTitle>{t('label.previewTitle')}</DialogTitle>
        <DialogContent dividers>
            <pre className={styles.previewContent}>{JSON.stringify(previewData, null, 2)}</pre>
        </DialogContent>
        <DialogActions>
            <Button label={t('label.downloadJson')} onClick={onDownload}/>
            <Button color="accent" label={t('label.startImport')} onClick={onStart}/>
        </DialogActions>
    </Dialog>
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
