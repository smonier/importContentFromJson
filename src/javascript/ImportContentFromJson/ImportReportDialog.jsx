import React from 'react';
import PropTypes from 'prop-types';
import {Button, Dialog} from '@jahia/moonstone';
import {DialogTitle, DialogContent, DialogActions} from '@mui/material';

const ImportReportDialog = ({open, onClose, report, t}) => {
    if (!report) {
        return null;
    }

    const {nodes = [], images = [], categories = []} = report;

    const renderTable = (items, firstHeader) => (
        <table style={{width: '100%', borderCollapse: 'collapse', marginBottom: '16px'}}>
            <thead>
                <tr>
                    <th style={{textAlign: 'left', borderBottom: '1px solid #ccc'}}>{firstHeader}</th>
                    <th style={{textAlign: 'left', borderBottom: '1px solid #ccc'}}>{t('label.status')}</th>
                </tr>
            </thead>
            <tbody>
                {items.map((item, index) => (
                    <tr key={index}>
                        <td style={{padding: '4px 8px'}}>{item.name}</td>
                        <td style={{padding: '4px 8px'}}>{item.status}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );

    return (
        <Dialog open={open} maxWidth="md" fullWidth onClose={onClose}>
            <DialogTitle>{t('label.reportTitle')}</DialogTitle>
            <DialogContent dividers>
                {nodes.length > 0 && renderTable(nodes, t('label.node'))}
                {images.length > 0 && renderTable(images, t('label.image'))}
                {categories.length > 0 && renderTable(categories, t('label.category'))}
            </DialogContent>
            <DialogActions>
                <Button label={t('label.closeReport')} onClick={onClose}/>
            </DialogActions>
        </Dialog>
    );
};

ImportReportDialog.propTypes = {
    open: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    report: PropTypes.object,
    t: PropTypes.func.isRequired
};

export default ImportReportDialog;
