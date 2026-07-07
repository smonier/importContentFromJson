import React from 'react';
import PropTypes from 'prop-types';
import {Button, Modal, ModalHeader, ModalBody, ModalFooter} from '@jahia/moonstone';
import styles from './ImportContent.component.scss';

/**
 * Dialog showing the preview of mapped JSON data before import.
 */
const ImportPreviewDialog = ({open, onClose, previewData, onDownload, onStart, t}) => (
    <Modal isOpen={open} size="large" onOpenChange={isOpen => !isOpen && onClose()}>
        <>
            <ModalHeader title={t('label.previewTitle')}/>
            <ModalBody>
                <pre className={styles.previewContent}>{JSON.stringify(previewData, null, 2)}</pre>
            </ModalBody>
            <ModalFooter>
                <Button label={t('label.downloadJson')} onClick={onDownload}/>
                <Button color="accent" label={t('label.startImport')} onClick={onStart}/>
            </ModalFooter>
        </>
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
