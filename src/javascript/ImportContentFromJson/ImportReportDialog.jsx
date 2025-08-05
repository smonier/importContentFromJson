import React from 'react';
import PropTypes from 'prop-types';
import {Button} from '@jahia/moonstone';
import {Dialog, DialogTitle, DialogContent, DialogActions} from '@mui/material';

const ImportReportDialog = ({open, onClose, report, t}) => {
    if (!report) {
        return null;
    }

    const {nodes = [], images = [], categories = [], errors = [], path} = report;

    const renderTable = (items, firstHeader) => (
        <table style={{width: '100%', borderCollapse: 'collapse', marginBottom: '16px', fontSize: '0.85rem'}}>
            <thead>
                <tr>
                    <th style={{textAlign: 'left', borderBottom: '1px solid #ccc'}}>{firstHeader}</th>
                    <th style={{textAlign: 'left', borderBottom: '1px solid #ccc'}}>{t('label.nodePath')}</th>
                    <th style={{textAlign: 'left', borderBottom: '1px solid #ccc'}}>{t('label.status')}</th>
                </tr>
            </thead>
            <tbody>
                {items.map((item, index) => (
                    <tr key={index}>
                        <td style={{padding: '4px 8px'}}>{item.name}</td>
                        <td style={{padding: '4px 8px'}}>{item.node || ''}</td>
                        <td style={{padding: '4px 8px'}}>{item.status}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );

    const renderErrorTable = items => (
        <table style={{width: '100%', borderCollapse: 'collapse', marginBottom: '16px', fontSize: '0.85rem'}}>
            <thead>
                <tr>
                    <th style={{textAlign: 'left', borderBottom: '1px solid #ccc'}}>{t('label.node')}</th>
                    <th style={{textAlign: 'left', borderBottom: '1px solid #ccc'}}>{t('label.reason')}</th>
                    <th style={{textAlign: 'left', borderBottom: '1px solid #ccc'}}>{t('label.details')}</th>
                </tr>
            </thead>
            <tbody>
                {items.map((item, index) => (
                    <tr key={index}>
                        <td style={{padding: '4px 8px'}}>{item.node}</td>
                        <td style={{padding: '4px 8px'}}>{item.reason}</td>
                        <td style={{padding: '4px 8px'}}>{item.details}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );

    const handleDownload = () => {
        const blob = new Blob([JSON.stringify(report, null, 2)], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'import-report.json';
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <Dialog fullWidth open={open} maxWidth="md" onClose={onClose}>
            <DialogTitle>{t('label.reportTitle')}</DialogTitle>
            <DialogContent dividers>
                {path && (
                    <div style={{fontSize: '0.85rem', marginBottom: '8px'}}>
                        {t('label.reportPathPrefix')} {path}
                    </div>
                )}
                {nodes.length > 0 && renderTable(nodes, t('label.node'))}
                {images.length > 0 && renderTable(images, t('label.image'))}
                {categories.length > 0 && renderTable(categories, t('label.category'))}
                {errors.length > 0 && renderErrorTable(errors)}
            </DialogContent>
            <DialogActions>
                <Button label={t('label.downloadReport')} onClick={handleDownload}/>
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
